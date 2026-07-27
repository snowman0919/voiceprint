//! Deterministic local DSP primitives shared by browser analysis and offline validation.

use rustfft::{FftPlanner, num_complex::Complex32};
use wasm_bindgen::prelude::*;

const MIN_F0_HZ: f32 = 50.0;
const MAX_F0_HZ: f32 = 700.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SpectralFeatures {
    pub centroid_hz: f32,
    pub rolloff_85_hz: f32,
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

    let mut best = (0usize, f32::NEG_INFINITY);
    for lag in min_lag..=max_lag {
        let (mut numerator, mut left_energy, mut right_energy) = (0.0, 0.0, 0.0);
        for index in lag..centered.len() {
            numerator += centered[index] * centered[index - lag];
            left_energy += centered[index] * centered[index];
            right_energy += centered[index - lag] * centered[index - lag];
        }
        let correlation = numerator / (left_energy * right_energy).sqrt().max(1e-12);
        if correlation > best.1 {
            best = (lag, correlation);
        }
    }
    (best.1 >= 0.65).then_some(sample_rate / best.0 as f32)
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
    let threshold = total * 0.85;
    let mut cumulative = 0.0;
    let rolloff_85_hz = powers
        .iter()
        .position(|power| {
            cumulative += power;
            cumulative >= threshold
        })
        .unwrap_or(0) as f32
        * hz_per_bin;
    let geometric_mean = powers
        .iter()
        .map(|power| power.max(1e-12).ln())
        .sum::<f32>()
        / powers.len() as f32;
    let arithmetic_mean = total / powers.len() as f32;
    Some(SpectralFeatures {
        centroid_hz,
        rolloff_85_hz,
        flatness: geometric_mean.exp() / arithmetic_mean,
    })
}

#[wasm_bindgen]
pub fn estimate_f0_hz(frame: &[f32], sample_rate: f32) -> f32 {
    estimate_f0(frame, sample_rate).unwrap_or(f32::NAN)
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
    }
}
