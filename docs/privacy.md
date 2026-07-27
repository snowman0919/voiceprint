# Privacy

Voiceprint processes selected audio and microphone capture on this device. It does not upload raw audio, PCM, waveforms, spectrograms, F0/formant trajectories, embeddings, analysis results, or shared-result contents.

Static assets (the app shell, WASM, and an optional model) are requested from the host. A downloaded model is checked against the manifest SHA-256 and stored in the browser's Cache Storage. Delete it from Settings at any time. Recordings are not retained after the in-memory analysis flow unless the user explicitly saves a download.

Share links use the URL fragment. A fragment is not part of an HTTP request to the host. The payload excludes audio and identifiers; it can be modified by the person holding the link and is not an official certification.

The product is an acoustic practice aid, not medical advice. It does not diagnose disease, infer identity, determine biological sex or age, or make personality, emotion, or truthfulness claims.
