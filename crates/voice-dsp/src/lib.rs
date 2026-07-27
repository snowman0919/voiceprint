//! Deterministic local DSP primitives shared by browser analysis and offline validation.

use rustfft::{FftPlanner, num_complex::Complex32};
use wasm_bindgen::prelude::*;

const MIN_F0_HZ: f32 = 50.0;
const MAX_F0_HZ: f32 = 700.0;

/// Windowed-sinc mono resampler. The cutoff follows the lower Nyquist limit so
/// downsampling does not fold high-frequency energy into speech features.
pub fn resample_bandlimited(input: &[f32], source_rate: f32, target_rate: f32) -> Vec<f32> {
    if input.is_empty() || source_rate <= 0.0 || target_rate <= 0.0 {
        return Vec::new();
    }
    if (source_rate - target_rate).abs() < f32::EPSILON {
        return input.to_vec();
    }
    let ratio = target_rate / source_rate;
    let output_len = (input.len() as f32 * ratio).round() as usize;
    let cutoff = ratio.min(1.0) * 0.95;
    const HALF_TAPS: isize = 16;
    (0..output_len)
        .map(|output_index| {
            let position = output_index as f32 / ratio;
            let center = position.floor() as isize;
            let (mut sum, mut normalization) = (0.0, 0.0);
            for tap in -HALF_TAPS + 1..=HALF_TAPS {
                let index = center + tap;
                if !(0..input.len() as isize).contains(&index) {
                    continue;
                }
                let distance = position - index as f32;
                let sinc = if distance.abs() < 1e-6 {
                    cutoff
                } else {
                    (core::f32::consts::PI * cutoff * distance).sin()
                        / (core::f32::consts::PI * distance)
                };
                let window =
                    0.5 + 0.5 * (core::f32::consts::PI * distance / HALF_TAPS as f32).cos();
                let coefficient = sinc * window;
                sum += input[index as usize] * coefficient;
                normalization += coefficient;
            }
            sum / normalization.max(1e-12)
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SpectralFeatures {
    pub centroid_hz: f32,
    pub bandwidth_hz: f32,
    pub rolloff_85_hz: f32,
    pub rolloff_95_hz: f32,
    pub flatness: f32,
}

/// Estimates F0 with normalized autocorrelation. Returns `None` for silence or an
/// ambiguous period, rather than fabricating a pitch.
pub fn estimate_f0(frame: &[f32], sample_rate: f32) -> Option<f32> {
    if frame.len() < 4 || sample_rate <= 0.0 {
        return None;
    }
    let mean = frame.iter().sum::<f32>() / frame.len() as f32;
    let centered: Vec<f32> = frame.iter().map(|sample| sample - mean).collect();
    let energy = centered.iter().map(|sample| sample * sample).sum::<f32>();
    if energy < 1e-8 {
        return None;
    }
    let min_lag = (sample_rate / MAX_F0_HZ).floor().max(1.0) as usize;
    let max_lag = (sample_rate / MIN_F0_HZ).ceil() as usize;
    if min_lag >= frame.len() || max_lag >= frame.len() {
        return None;
    }

    let mut correlations = Vec::with_capacity(max_lag - min_lag + 1);
    for lag in min_lag..=max_lag {
        let (mut numerator, mut left_energy, mut right_energy) = (0.0, 0.0, 0.0);
        for index in lag..centered.len() {
            numerator += centered[index] * centered[index - lag];
            left_energy += centered[index] * centered[index];
            right_energy += centered[index - lag] * centered[index - lag];
        }
        let correlation = numerator / (left_energy * right_energy).sqrt().max(1e-12);
        correlations.push(correlation);
    }
    let first_period_peak = correlations
        .windows(3)
        .position(|window| window[1] >= 0.65 && window[1] >= window[0] && window[1] > window[2]);
    if let Some(index) = first_period_peak {
        return Some(sample_rate / (min_lag + index + 1) as f32);
    }
    let (index, correlation) = correlations
        .iter()
        .enumerate()
        .max_by(|(_, left), (_, right)| left.total_cmp(right))?;
    (*correlation >= 0.65).then_some(sample_rate / (min_lag + index) as f32)
}

/// Estimates harmonic-to-noise ratio from the normalized autocorrelation at the
/// detected period. Unvoiced/noisy frames remain unavailable instead of yielding
/// a misleading dB value.
pub fn harmonic_to_noise_ratio_db(frame: &[f32], sample_rate: f32) -> Option<f32> {
    let f0 = estimate_f0(frame, sample_rate)?;
    let lag = (sample_rate / f0).round() as usize;
    let mean = frame.iter().sum::<f32>() / frame.len() as f32;
    let centered: Vec<f32> = frame.iter().map(|sample| sample - mean).collect();
    let (mut numerator, mut left_energy, mut right_energy) = (0.0, 0.0, 0.0);
    for index in lag..centered.len() {
        numerator += centered[index] * centered[index - lag];
        left_energy += centered[index] * centered[index];
        right_energy += centered[index - lag] * centered[index - lag];
    }
    let periodicity = numerator / (left_energy * right_energy).sqrt().max(1e-12);
    (periodicity >= 0.8).then_some(10.0 * (periodicity / (1.0 - periodicity).max(1e-6)).log10())
}

/// Calculates spectral features from the first Hann-windowed frame. Callers choose
/// frame size and hop policy; this primitive never allocates an audio copy.
pub fn spectral_features(
    frame: &[f32],
    sample_rate: f32,
    fft_size: usize,
) -> Option<SpectralFeatures> {
    if frame.is_empty() || frame.len() > fft_size || fft_size < 2 || sample_rate <= 0.0 {
        return None;
    }
    let mut bins = vec![Complex32::new(0.0, 0.0); fft_size];
    for (index, sample) in frame.iter().enumerate() {
        let window =
            0.5 - 0.5 * (2.0 * core::f32::consts::PI * index as f32 / frame.len() as f32).cos();
        bins[index].re = sample * window;
    }
    FftPlanner::<f32>::new()
        .plan_fft_forward(fft_size)
        .process(&mut bins);
    let powers: Vec<f32> = bins[..=(fft_size / 2)]
        .iter()
        .map(|bin| bin.norm_sqr())
        .collect();
    let total = powers.iter().sum::<f32>();
    if total <= 1e-12 {
        return None;
    }
    let hz_per_bin = sample_rate / fft_size as f32;
    let centroid_hz = powers
        .iter()
        .enumerate()
        .map(|(bin, power)| bin as f32 * hz_per_bin * power)
        .sum::<f32>()
        / total;
    let bandwidth_hz = (powers
        .iter()
        .enumerate()
        .map(|(bin, power)| ((bin as f32 * hz_per_bin - centroid_hz).powi(2)) * power)
        .sum::<f32>()
        / total)
        .sqrt();
    let rolloff = |fraction: f32| {
        let mut cumulative = 0.0;
        powers
            .iter()
            .position(|power| {
                cumulative += power;
                cumulative >= total * fraction
            })
            .unwrap_or(0) as f32
            * hz_per_bin
    };
    let geometric_mean = powers
        .iter()
        .map(|power| power.max(1e-12).ln())
        .sum::<f32>()
        / powers.len() as f32;
    let arithmetic_mean = total / powers.len() as f32;
    Some(SpectralFeatures {
        centroid_hz,
        bandwidth_hz,
        rolloff_85_hz: rolloff(0.85),
        rolloff_95_hz: rolloff(0.95),
        flatness: geometric_mean.exp() / arithmetic_mean,
    })
}

#[wasm_bindgen]
pub fn estimate_f0_hz(frame: &[f32], sample_rate: f32) -> f32 {
    estimate_f0(frame, sample_rate).unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_centroid_hz(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.centroid_hz)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_bandwidth_hz(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.bandwidth_hz)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_rolloff_85_hz(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.rolloff_85_hz)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_rolloff_95_hz(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.rolloff_95_hz)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_flatness(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.flatness)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn hnr_db(frame: &[f32], sample_rate: f32) -> f32 {
    harmonic_to_noise_ratio_db(frame, sample_rate).unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn resample_to_24khz(samples: &[f32], source_rate: f32) -> Vec<f32> {
    resample_bandlimited(samples, source_rate, 24_000.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(hz: f32, seconds: f32, sample_rate: f32) -> Vec<f32> {
        (0..(seconds * sample_rate) as usize)
            .map(|index| (2.0 * core::f32::consts::PI * hz * index as f32 / sample_rate).sin())
            .collect()
    }

    #[test]
    fn tracks_a_known_pitch_without_a_narrow_demographic_range() {
        let frame = sine(220.0, 0.08, 24_000.0);
        let f0 = estimate_f0(&frame, 24_000.0).expect("periodic speech-like frame should have F0");
        assert!((f0 - 220.0).abs() < 3.0, "expected 220Hz, got {f0}");
    }

    #[test]
    fn avoids_halving_pitch_at_a_common_browser_sample_rate() {
        let frame = sine(220.0, 0.08, 44_100.0);
        let f0 = estimate_f0(&frame, 44_100.0).expect("periodic frame should have F0");
        assert!((f0 - 220.0).abs() < 3.0, "expected 220Hz, got {f0}");
    }

    #[test]
    fn returns_no_pitch_for_silence_instead_of_a_false_result() {
        assert_eq!(estimate_f0(&vec![0.0; 2_400], 24_000.0), None);
    }

    #[test]
    fn locates_tonal_energy_in_the_expected_spectrum_region() {
        let frame = sine(1_000.0, 0.04, 24_000.0);
        let spectrum =
            spectral_features(&frame, 24_000.0, 1024).expect("tone has measurable spectrum");
        assert!(
            (spectrum.centroid_hz - 1_000.0).abs() < 60.0,
            "unexpected centroid: {}",
            spectrum.centroid_hz
        );
        assert!(
            spectrum.bandwidth_hz < 180.0,
            "tone should stay narrow: {}",
            spectrum.bandwidth_hz
        );
        assert!(
            spectrum.flatness < 0.02,
            "tone should not resemble noise: {}",
            spectrum.flatness
        );
    }

    #[test]
    fn separates_broadband_noise_from_a_tonal_spectrum() {
        let noise = (0..1024)
            .scan(0x1234_5678_u32, |state, _| {
                *state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                Some((*state as f32 / u32::MAX as f32) * 2.0 - 1.0)
            })
            .collect::<Vec<_>>();
        let spectrum = spectral_features(&noise, 24_000.0, 1024).expect("noise has spectrum");
        assert!(
            spectrum.flatness > 0.3,
            "noise should be comparatively flat: {}",
            spectrum.flatness
        );
        assert!(spectrum.rolloff_95_hz > spectrum.rolloff_85_hz);
        assert!(
            spectrum.bandwidth_hz > 2_000.0,
            "noise should be broadband: {}",
            spectrum.bandwidth_hz
        );
    }

    #[test]
    fn returns_hnr_for_periodic_signal_but_not_unvoiced_noise() {
        let sine_frame = sine(220.0, 0.08, 24_000.0);
        let hnr = harmonic_to_noise_ratio_db(&sine_frame, 24_000.0).expect("periodic tone has HNR");
        assert!(hnr > 20.0, "clean tone should have high HNR, got {hnr}");
        let noise = (0..1_920)
            .map(|index| ((index * 7 % 17) as f32 / 8.0) - 1.0)
            .collect::<Vec<_>>();
        assert_eq!(harmonic_to_noise_ratio_db(&noise, 24_000.0), None);
    }

    #[test]
    fn downsampling_preserves_speech_band_tone_and_rejects_alias_energy() {
        let speech_band = sine(1_000.0, 0.12, 48_000.0);
        let downsampled = resample_bandlimited(&speech_band, 48_000.0, 24_000.0);
        let spectrum = spectral_features(&downsampled[..1024], 24_000.0, 1024)
            .expect("resampled tone has spectrum");
        assert!(
            (spectrum.centroid_hz - 1_000.0).abs() < 70.0,
            "speech-band frequency drifted: {}",
            spectrum.centroid_hz
        );

        let out_of_band = sine(18_000.0, 0.12, 48_000.0);
        let filtered = resample_bandlimited(&out_of_band, 48_000.0, 24_000.0);
        let rms = (filtered.iter().map(|sample| sample * sample).sum::<f32>()
            / filtered.len() as f32)
            .sqrt();
        assert!(rms < 0.15, "out-of-band signal aliased into output: {rms}");
    }
}
