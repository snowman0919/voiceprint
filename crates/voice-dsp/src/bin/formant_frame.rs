use std::{env, error::Error, path::Path};

use voice_dsp::estimate_formants;

fn read_mono(path: &Path) -> Result<(Vec<f32>, f32), Box<dyn Error>> {
    let mut reader = hound::WavReader::open(path)?;
    let spec = reader.spec();
    if spec.channels == 0 || spec.sample_rate == 0 {
        return Err("WAV has no usable channel or sample rate".into());
    }
    let channels = spec.channels as usize;
    let values = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().collect::<Result<Vec<_>, _>>()?,
        hound::SampleFormat::Int => {
            let scale = (1_i64 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .map(|value| value.map(|sample| sample as f32 / scale))
                .collect::<Result<Vec<_>, _>>()?
        }
    };
    let mono = values
        .chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / frame.len() as f32)
        .collect();
    Ok((mono, spec.sample_rate as f32))
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut arguments = env::args().skip(1);
    let path = arguments
        .next()
        .ok_or("usage: formant_frame WAV START_SECONDS [FRAME_SECONDS]")?;
    let start_seconds = arguments
        .next()
        .ok_or("usage: formant_frame WAV START_SECONDS [FRAME_SECONDS]")?
        .parse::<f32>()?;
    let frame_seconds = arguments
        .next()
        .map(|value| value.parse())
        .transpose()?
        .unwrap_or(0.025_f32);
    if start_seconds < 0.0 || frame_seconds <= 0.0 {
        return Err("frame start and length must be positive".into());
    }
    let (samples, sample_rate) = read_mono(Path::new(&path))?;
    let start = (start_seconds * sample_rate).round() as usize;
    let length = (frame_seconds * sample_rate).round() as usize;
    let frame = samples
        .get(start..start.saturating_add(length))
        .ok_or("requested frame is outside WAV")?;
    if let Some(features) = estimate_formants(frame, sample_rate) {
        println!(
            "{{\"f1Hz\":{:.3},\"f2Hz\":{:.3},\"f3Hz\":{:.3},\"residualRatio\":{:.6},\"ceilingHz\":{:.1}}}",
            features.f1_hz,
            features.f2_hz,
            features.f3_hz,
            features.residual_ratio,
            features.ceiling_hz
        );
    } else {
        println!("null");
    }
    Ok(())
}
