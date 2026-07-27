"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { AudioQuality } from "@/lib/audio-quality";

type InputInfo = { sampleRate: number; durationSeconds: number; source: string };
type RecordingState = "idle" | "recording" | "checking" | "ready" | "error";

function formatSeconds(value: number) {
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
}

export function Recorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [quality, setQuality] = useState<AudioQuality>();
  const [input, setInput] = useState<InputInfo>();
  const [message, setMessage] = useState<string>();
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const context = useRef<AudioContext | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const meter = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);

  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    void context.current?.close();
    context.current = undefined;
    if (timer.current) window.clearInterval(timer.current);
    if (meter.current) window.cancelAnimationFrame(meter.current);
  }

  async function inspect(blob: Blob, source: string) {
    setState("checking");
    try {
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      const mono = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / buffer.numberOfChannels;
      }
      await context.close();
      const result = await new Promise<AudioQuality>((resolve, reject) => {
        const worker = new Worker(new URL("../../workers/quality.worker.ts", import.meta.url));
        worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
        worker.onerror = () => { worker.terminate(); reject(new Error("품질 검사를 시작할 수 없습니다.")); };
        worker.postMessage({ pcm: mono.buffer, sampleRate: buffer.sampleRate }, [mono.buffer]);
      });
      setInput({ sampleRate: buffer.sampleRate, durationSeconds: buffer.duration, source });
      setQuality(result);
      setMessage(result.issues[0]);
      setState("ready");
    } catch {
      setMessage("지원하지 않는 파일이거나 음성을 읽을 수 없습니다.");
      setState("error");
    }
  }

  async function startRecording() {
    setMessage(undefined);
    setQuality(undefined);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = media;
      const audio = new AudioContext();
      context.current = audio;
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const draw = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        samples.forEach((sample) => { const normalized = (sample - 128) / 128; sum += normalized * normalized; });
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        meter.current = window.requestAnimationFrame(draw);
      };
      draw();
      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const activeRecorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      activeRecorder.onstop = () => { stopTracks(); void inspect(new Blob(chunks, { type: activeRecorder.mimeType }), "마이크 녹음"); };
      startedAt.current = Date.now();
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
      activeRecorder.start();
      setState("recording");
    } catch {
      setMessage("마이크 권한이 필요합니다. 브라우저 설정에서 허용한 뒤 다시 시도하세요.");
      setState("error");
    }
  }

  function stopRecording() { recorder.current?.stop(); }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void inspect(file, "로컬 파일");
  }

  const canAnalyze = state === "ready" && quality?.issues.length === 0;
  return (
    <section className="recorder" aria-labelledby="recording-heading">
      <div><p className="eyebrow">입력</p><h2 id="recording-heading">목소리를 준비하세요</h2></div>
      <p className="prompt">권장 15~30초. 편안한 음역에서 자연스럽게 말해 보세요.</p>
      <div className="meter" aria-label={`입력 음량 ${Math.round(level * 100)}%`}><span style={{ transform: `scaleX(${level})` }} /></div>
      <p className="time">{state === "recording" ? formatSeconds(elapsed) : "0:00"} / 1:00</p>
      {state === "recording" ? <button onClick={stopRecording} type="button">녹음 중지</button> : <button onClick={() => void startRecording()} type="button">녹음 시작</button>}
      <label className="file"><span>또는 로컬 파일 선택</span><input accept="audio/*" onChange={selectFile} type="file" /></label>
      {state === "checking" && <p role="status">입력 품질 확인 중…</p>}
      {message && <p className={quality?.issues.length ? "warning" : "error"} role="status">{message}</p>}
      {quality && input && <dl className="quality"><div><dt>길이</dt><dd>{input.durationSeconds.toFixed(1)}초</dd></div><div><dt>입력 음량</dt><dd>{Math.round(quality.rms * 100)}%</dd></div><div><dt>clipping</dt><dd>{(quality.clippingRatio * 100).toFixed(2)}%</dd></div><div><dt>유성음</dt><dd>{Math.round(quality.voicedRatio * 100)}%</dd></div></dl>}
      <button disabled={!canAnalyze} type="button">분석 시작</button>
      {input && <p className="metadata">{input.source} · {input.sampleRate.toLocaleString()}Hz · 이 기기에서만 처리</p>}
    </section>
  );
}
