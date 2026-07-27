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
    pub slope_db_per_khz: f32,
    pub low_band_ratio: f32,
    pub mid_band_ratio: f32,
    pub high_band_ratio: f32,
}

/// A conservative formant estimate from a Burg-LPC spectral envelope.  The
/// browser caller still needs temporal continuity and an offline reference
/// comparison before showing these values as production phonetic evidence.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FormantFeatures {
    pub f1_hz: f32,
    pub f2_hz: f32,
    pub f3_hz: f32,
    pub residual_ratio: f32,
    pub ceiling_hz: f32,
}

fn burg_lpc(samples: &[f32], order: usize) -> Option<(Vec<f32>, f32)> {
    if samples.len() <= order + 2 || order < 2 {
        return None;
    }
    let mean = samples.iter().sum::<f32>() / samples.len() as f32;
    let mut signal = Vec::with_capacity(samples.len());
    for (index, sample) in samples.iter().enumerate() {
        let previous = if index == 0 { mean } else { samples[index - 1] };
        signal.push((sample - mean) - 0.97 * (previous - mean));
    }
    let source_energy = signal.iter().map(|value| value * value).sum::<f32>();
    if source_energy <= 1e-8 {
        return None;
    }
    let mut forward = signal[1..].to_vec();
    let mut backward = signal[..signal.len() - 1].to_vec();
    let mut coefficients = vec![1.0];
    for stage in 1..=order {
        if forward.len() < 2 {
            return None;
        }
        let numerator = -2.0
            * forward
                .iter()
                .zip(&backward)
                .map(|(left, right)| left * right)
                .sum::<f32>();
        let denominator = forward.iter().map(|value| value * value).sum::<f32>()
            + backward.iter().map(|value| value * value).sum::<f32>();
        if denominator <= 1e-12 {
            return None;
        }
        let reflection = numerator / denominator;
        if !reflection.is_finite() || reflection.abs() >= 0.9999 {
            return None;
        }
        let previous = coefficients.clone();
        coefficients.push(reflection);
        for index in 1..stage {
            coefficients[index] = previous[index] + reflection * previous[stage - index];
        }
        let mut next_forward = Vec::with_capacity(forward.len() - 1);
        let mut next_backward = Vec::with_capacity(backward.len() - 1);
        for index in 1..forward.len() {
            next_forward.push(forward[index] + reflection * backward[index]);
            next_backward.push(backward[index - 1] + reflection * forward[index - 1]);
        }
        forward = next_forward;
        backward = next_backward;
    }
    let residual = (order..signal.len())
        .map(|index| {
            let prediction = (1..=order)
                .map(|coefficient| coefficients[coefficient] * signal[index - coefficient])
                .sum::<f32>();
            let error = signal[index] + prediction;
            error * error
        })
        .sum::<f32>()
        / source_energy;
    Some((coefficients, residual))
}

fn lpc_envelope_peaks(coefficients: &[f32], sample_rate: f32, ceiling_hz: f32) -> Vec<(f32, f32)> {
    const BINS: usize = 2_048;
    let maximum_bin = ((ceiling_hz / sample_rate * BINS as f32).floor() as usize).min(BINS / 2);
    let powers = (0..=maximum_bin)
        .map(|bin| {
            let frequency = bin as f32 * sample_rate / BINS as f32;
            let omega = 2.0 * core::f32::consts::PI * frequency / sample_rate;
            let (real, imaginary) = coefficients.iter().enumerate().fold(
                (0.0, 0.0),
                |(real, imaginary), (index, coefficient)| {
                    (
                        real + coefficient * (omega * index as f32).cos(),
                        imaginary - coefficient * (omega * index as f32).sin(),
                    )
                },
            );
            1.0 / (real * real + imaginary * imaginary).max(1e-12)
        })
        .collect::<Vec<_>>();
    let maximum_power = powers.iter().copied().fold(0.0_f32, f32::max);
    let mut candidates = powers
        .windows(3)
        .enumerate()
        .filter_map(|(index, values)| {
            let bin = index + 1;
            let frequency = bin as f32 * sample_rate / BINS as f32;
            (frequency >= 150.0
                && values[1] >= maximum_power * 0.03
                && values[1] > values[0]
                && values[1] >= values[2])
                .then_some((frequency, values[1]))
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| left.0.total_cmp(&right.0));
    let mut selected: Vec<(f32, f32)> = Vec::new();
    for candidate in candidates {
        if selected
            .iter()
            .all(|(frequency, _)| (candidate.0 - frequency).abs() >= 140.0)
        {
            selected.push(candidate);
        }
        if selected.len() == 3 {
            break;
        }
    }
    selected.sort_by(|left, right| left.0.total_cmp(&right.0));
    selected
}

fn complete_formant_features(
    peaks: &[(f32, f32)],
    residual_ratio: f32,
    ceiling_hz: f32,
) -> Option<FormantFeatures> {
    let [f1, f2, f3] = peaks else {
        return None;
    };
    Some(FormantFeatures {
        f1_hz: f1.0,
        f2_hz: f2.0,
        f3_hz: f3.0,
        residual_ratio,
        ceiling_hz,
    })
}

/// Evaluates several formant ceilings and returns only a complete, ordered
/// three-formant path.  Missing or unstable candidates remain unavailable.
pub fn estimate_formants(frame: &[f32], sample_rate: f32) -> Option<FormantFeatures> {
    if sample_rate <= 0.0 || frame.len() < 240 {
        return None;
    }
    let order = ((sample_rate / 1_000.0).round() as usize * 2).clamp(10, 24);
    let (coefficients, residual_ratio) = burg_lpc(frame, order)?;
    [
        4_500.0, 5_000.0, 5_500.0, 6_000.0, 6_500.0, 7_000.0, 8_000.0,
    ]
    .into_iter()
    .filter(|ceiling| *ceiling < sample_rate * 0.5 - 100.0)
    .filter_map(|ceiling_hz| {
        let peaks = lpc_envelope_peaks(&coefficients, sample_rate, ceiling_hz);
        complete_formant_features(&peaks, residual_ratio, ceiling_hz)
    })
    .min_by(|left, right| left.residual_ratio.total_cmp(&right.residual_ratio))
}

/// Produces a time-major Hann-windowed log-power spectrogram. When the source
/// has more frames than `max_frames`, it samples across the entire recording so
/// the browser can render an overview without retaining an unbounded matrix.
pub fn log_power_spectrogram(
    samples: &[f32],
    frame_size: usize,
    fft_size: usize,
    hop_size: usize,
    max_frames: usize,
) -> Vec<f32> {
    if frame_size < 2
        || frame_size > fft_size
        || hop_size == 0
        || max_frames == 0
        || samples.len() < frame_size
    {
        return Vec::new();
    }
    let available_frames = 1 + (samples.len() - frame_size) / hop_size;
    let frame_count = available_frames.min(max_frames);
    let bins_per_frame = fft_size / 2 + 1;
    let mut output = Vec::with_capacity(frame_count * bins_per_frame);
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(fft_size);
    for frame_index in 0..frame_count {
        let source_frame = if frame_count == 1 {
            0
        } else {
            frame_index * (available_frames - 1) / (frame_count - 1)
        };
        let offset = source_frame * hop_size;
        let mut bins = vec![Complex32::new(0.0, 0.0); fft_size];
        for (index, bin) in bins.iter_mut().take(frame_size).enumerate() {
            let window = 0.5
                - 0.5
                    * (2.0 * core::f32::consts::PI * index as f32 / (frame_size - 1) as f32).cos();
            bin.re = samples[offset + index] * window;
        }
        fft.process(&mut bins);
        output.extend(
            bins[..bins_per_frame]
                .iter()
                .map(|bin| bin.norm_sqr().max(1e-12).log10()),
        );
    }
    output
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

fn power_spectrum(frame: &[f32], fft_size: usize) -> Option<Vec<f32>> {
    if frame.is_empty() || frame.len() > fft_size || fft_size < 2 {
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
    Some(
        bins[..=(fft_size / 2)]
            .iter()
            .map(|bin| bin.norm_sqr())
            .collect(),
    )
}

/// Calculates spectral features from one Hann-windowed frame. Callers choose
/// frame size and hop policy; this primitive never allocates an audio copy.
pub fn spectral_features(
    frame: &[f32],
    sample_rate: f32,
    fft_size: usize,
) -> Option<SpectralFeatures> {
    if sample_rate <= 0.0 {
        return None;
    }
    let powers = power_spectrum(frame, fft_size)?;
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
    let mean_x = (0..powers.len())
        .map(|bin| bin as f32 * hz_per_bin / 1_000.0)
        .sum::<f32>()
        / powers.len() as f32;
    let mean_y = powers
        .iter()
        .map(|power| 10.0 * power.max(1e-12).log10())
        .sum::<f32>()
        / powers.len() as f32;
    let (covariance, variance) =
        powers
            .iter()
            .enumerate()
            .fold((0.0, 0.0), |(covariance, variance), (bin, power)| {
                let x = bin as f32 * hz_per_bin / 1_000.0 - mean_x;
                let y = 10.0 * power.max(1e-12).log10() - mean_y;
                (covariance + x * y, variance + x * x)
            });
    let ratio_in = |start_hz: f32, end_hz: f32| {
        powers
            .iter()
            .enumerate()
            .filter(|(bin, _)| {
                let frequency = *bin as f32 * hz_per_bin;
                frequency >= start_hz && frequency < end_hz
            })
            .map(|(_, power)| power)
            .sum::<f32>()
            / total
    };
    Some(SpectralFeatures {
        centroid_hz,
        bandwidth_hz,
        rolloff_85_hz: rolloff(0.85),
        rolloff_95_hz: rolloff(0.95),
        flatness: geometric_mean.exp() / arithmetic_mean,
        slope_db_per_khz: covariance / variance.max(1e-12),
        low_band_ratio: ratio_in(0.0, 1_000.0),
        mid_band_ratio: ratio_in(1_000.0, 4_000.0),
        high_band_ratio: ratio_in(4_000.0, sample_rate * 0.5 + hz_per_bin),
    })
}

/// Normalized positive spectral change between neighboring frames. A repeated
/// frame is zero; a new dominant frequency produces a positive value.
pub fn spectral_flux(previous: &[f32], current: &[f32], fft_size: usize) -> Option<f32> {
    let previous = power_spectrum(previous, fft_size)?;
    let current = power_spectrum(current, fft_size)?;
    let previous_total = previous.iter().sum::<f32>();
    let current_total = current.iter().sum::<f32>();
    if previous_total <= 1e-12 || current_total <= 1e-12 {
        return None;
    }
    Some(
        previous
            .iter()
            .zip(&current)
            .map(|(left, right)| (right / current_total - left / previous_total).max(0.0))
            .sum(),
    )
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
pub fn spectral_slope_db_per_khz(frame: &[f32], sample_rate: f32) -> f32 {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| features.slope_db_per_khz)
        .unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn spectral_band_energy_ratios(frame: &[f32], sample_rate: f32) -> Vec<f32> {
    spectral_features(frame, sample_rate, 1024)
        .map(|features| {
            vec![
                features.low_band_ratio,
                features.mid_band_ratio,
                features.high_band_ratio,
            ]
        })
        .unwrap_or_default()
}

#[wasm_bindgen]
pub fn spectral_flux_wasm(previous: &[f32], current: &[f32]) -> f32 {
    spectral_flux(previous, current, 1024).unwrap_or(f32::NAN)
}

#[wasm_bindgen]
pub fn hnr_db(frame: &[f32], sample_rate: f32) -> f32 {
    harmonic_to_noise_ratio_db(frame, sample_rate).unwrap_or(f32::NAN)
}

/// Returns F1, F2, F3, residual ratio, and selected ceiling; an empty vector
/// means that no complete LPC candidate satisfied the conservative gate.
#[wasm_bindgen]
pub fn estimate_formants_wasm(frame: &[f32], sample_rate: f32) -> Vec<f32> {
    estimate_formants(frame, sample_rate)
        .map(|features| {
            vec![
                features.f1_hz,
                features.f2_hz,
                features.f3_hz,
                features.residual_ratio,
                features.ceiling_hz,
            ]
        })
        .unwrap_or_default()
}

#[wasm_bindgen]
pub fn log_power_spectrogram_wasm(
    samples: &[f32],
    frame_size: usize,
    fft_size: usize,
    hop_size: usize,
    max_frames: usize,
) -> Vec<f32> {
    log_power_spectrogram(samples, frame_size, fft_size, hop_size, max_frames)
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

    fn resonant_signal(frequencies: &[f32], seconds: f32, sample_rate: f32) -> Vec<f32> {
        (0..(seconds * sample_rate) as usize)
            .map(|index| {
                frequencies
                    .iter()
                    .enumerate()
                    .map(|(harmonic, frequency)| {
                        (2.0 * core::f32::consts::PI * frequency * index as f32 / sample_rate).sin()
                            / (harmonic + 1) as f32
                    })
                    .sum()
            })
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
    fn distinguishes_low_and_high_frequency_energy_and_frame_change() {
        let low = sine(500.0, 0.04, 24_000.0);
        let high = sine(5_000.0, 0.04, 24_000.0);
        let low_features = spectral_features(&low, 24_000.0, 1024).expect("low tone has spectrum");
        let high_features =
            spectral_features(&high, 24_000.0, 1024).expect("high tone has spectrum");
        assert!(
            low_features.low_band_ratio > high_features.low_band_ratio,
            "500Hz tone must concentrate energy below 1kHz"
        );
        assert!(
            high_features.high_band_ratio > low_features.high_band_ratio,
            "5kHz tone must concentrate energy above 4kHz"
        );
        assert!(
            spectral_flux(&low, &low, 1024).expect("repeated frame has flux") < 1e-5,
            "unchanged frame must not report timbral movement"
        );
        assert!(
            spectral_flux(&low, &high, 1024).expect("changed frame has flux") > 0.5,
            "different dominant frequency must produce substantial spectral flux"
        );
    }

    #[test]
    fn stft_keeps_a_tone_in_its_expected_frequency_bin() {
        let audio = sine(1_000.0, 0.12, 24_000.0);
        let fft_size = 1_024;
        let spectrum = log_power_spectrogram(&audio, 600, fft_size, 240, 8);
        let first_frame = &spectrum[..fft_size / 2 + 1];
        let (peak_bin, _) = first_frame
            .iter()
            .enumerate()
            .max_by(|(_, left), (_, right)| left.total_cmp(right))
            .expect("a valid STFT frame has bins");
        let peak_hz = peak_bin as f32 * 24_000.0 / fft_size as f32;
        assert!(
            (peak_hz - 1_000.0).abs() < 40.0,
            "tone peak drifted to {peak_hz}Hz"
        );
    }

    #[test]
    fn stft_silence_has_finite_epsilon_floored_values() {
        let spectrum = log_power_spectrogram(&vec![0.0; 1_024], 600, 1_024, 240, 8);
        assert!(
            spectrum
                .iter()
                .all(|value| value.is_finite() && *value <= -11.9),
            "silence must not generate NaN/Inf or false energy"
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

    #[test]
    fn burg_lpc_recovers_ordered_resonance_peaks_without_inventing_silence_formants() {
        let frame = resonant_signal(&[500.0, 1_500.0, 2_500.0], 0.08, 24_000.0);
        let formants = estimate_formants(&frame, 24_000.0)
            .expect("three synthetic resonances should produce a complete LPC path");
        assert!(
            (formants.f1_hz - 500.0).abs() < 180.0,
            "unexpected F1: {}",
            formants.f1_hz
        );
        assert!(
            (formants.f2_hz - 1_500.0).abs() < 220.0,
            "unexpected F2: {}",
            formants.f2_hz
        );
        assert!(
            (formants.f3_hz - 2_500.0).abs() < 260.0,
            "unexpected F3: {}",
            formants.f3_hz
        );
        assert!(formants.f1_hz < formants.f2_hz && formants.f2_hz < formants.f3_hz);
        assert_eq!(estimate_formants(&vec![0.0; 1_920], 24_000.0), None);
    }

    #[test]
    fn incomplete_lpc_peak_set_is_unavailable_not_a_runtime_failure() {
        assert_eq!(
            complete_formant_features(&[(500.0, 1.0), (1_500.0, 0.7)], 0.2, 5_500.0),
            None,
            "real speech can contain a partial peak set; it must not index missing F3"
        );
    }
}
