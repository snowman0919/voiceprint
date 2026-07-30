# Privacy

Voiceprint processes selected audio and microphone capture on this device. It does not upload raw audio, PCM, waveforms, spectrograms, F0/formant trajectories, embeddings, microphone names, or browser fingerprints.

Static assets (the app shell, WASM, and an optional model) are requested from the host. A downloaded model is checked against the manifest SHA-256 and stored in the browser's Cache Storage. Delete it from Settings at any time. Recordings are not retained after the in-memory analysis flow unless the user explicitly saves a download.

For the personal-result service, the browser sends only a scalar result record after local analysis: a random recovery ID, timestamp, displayed impression summary, and scalar acoustic/quality values. It does not send an audio file or frame array. The result service stores this record in SQLite for 365 days, purges expired records on service activity, and permits deletion when the browser presents the matching recovery ID.

The recovery ID is generated randomly in browser local storage; it is not a browser or device fingerprint. Shared-result URLs use `#share=<secret>`: the fragment holds a random share secret, not the result content, so it is not sent in the initial HTTP request. The browser exchanges that secret with the same-origin result service to load the stored scalar result. Anyone who receives that secret can view the shared record until it expires or is deleted.

Before public distribution, the deployed privacy page must replace the controller name and contact placeholder with the operator's actual legal contact details and be reviewed for the hosting, backup, and jurisdiction in use.

The product is an acoustic practice aid, not medical advice. It does not diagnose disease, infer identity, determine biological sex or age, or make personality, emotion, or truthfulness claims.
