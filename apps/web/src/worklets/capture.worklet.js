class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(sampleRate * 60);
    this.length = 0;
    this.dropped = false;
    this.port.onmessage = ({ data }) => {
      if (data.type !== "flush") return;
      const pcm = this.samples.slice(0, this.length);
      this.port.postMessage({ type: "pcm", pcm: pcm.buffer, dropped: this.dropped }, [pcm.buffer]);
    };
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input) return true;
    if (output) output.fill(0);
    const available = this.samples.length - this.length;
    const copied = Math.min(available, input.length);
    this.samples.set(input.subarray(0, copied), this.length);
    this.length += copied;
    this.dropped ||= copied < input.length;
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
