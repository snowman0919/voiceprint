use criterion::{Criterion, black_box, criterion_group, criterion_main};
use voice_dsp::{estimate_f0, harmonic_to_noise_ratio_db, spectral_features};

fn frame() -> Vec<f32> {
    (0..1_920)
        .map(|index| (2.0 * core::f32::consts::PI * 220.0 * index as f32 / 24_000.0).sin())
        .collect()
}

fn benchmark_dsp(criterion: &mut Criterion) {
    let samples = frame();
    let mut group = criterion.benchmark_group("24khz_80ms_frame");
    group.bench_function("f0", |bench| bench.iter(|| estimate_f0(black_box(&samples), 24_000.0)));
    group.bench_function("hnr", |bench| bench.iter(|| harmonic_to_noise_ratio_db(black_box(&samples), 24_000.0)));
    group.bench_function("spectrum", |bench| bench.iter(|| spectral_features(black_box(&samples[..1024]), 24_000.0, 1024)));
    group.finish();
}

criterion_group!(benches, benchmark_dsp);
criterion_main!(benches);
