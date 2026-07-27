# Audio analysis

The browser records or decodes mono Float32 PCM and records its actual sample rate. The local DSP worker uses band-limited resampling to 24 kHz before analysis. A 16 kHz derivative is reserved for the fixed-shape ONNX model input. Browser analysis constants live in `apps/web/src/lib/analysis-config.ts` and share the displayed DSP version.

Current measurements are deliberate, confidence-gated measurements: duration, RMS, peak, clipping ratio, DC offset, silence/voiced ratio, autocorrelation F0, spectral centroid, HNR, and a log-power STFT spectrogram. The spectrogram uses a 25 ms Hann window, 10 ms hop, 1,024-point FFT, epsilon power floor, and a bounded 128-frame overview sampled across the recording. HNR is unavailable rather than fabricated when periodicity confidence is too low. The Rust tests cover a 220 Hz signal at both 24 and 44.1 kHz, silence rejection, tonal STFT-bin placement, silence flooring, harmonic/noise HNR separation, and anti-aliasing during 48→24 kHz conversion.

The application does not currently claim formant, CPP, jitter, shimmer, SNR, or trained impression scores. Those fields remain absent until their algorithms have an offline reference comparison and meaningful signal-quality gate. This prevents a number-shaped placeholder from being presented as phonetic evidence.
