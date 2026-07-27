"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import type { AudioQuality } from "@/lib/audio-quality";
import type { DspSummary } from "@/lib/dsp";
import { downloadSummaryPng, downloadText } from "@/lib/download";
import { createLocalAnalysis, scalarCsv, type LocalAnalysis } from "@/lib/results";
import { brand } from "@/lib/brand";

type InputInfo = { sampleRate: number; durationSeconds: number; source: string };
type RecordingState = "idle" | "recording" | "checking" | "ready" | "error";
type CapturedPcm = { pcm: ArrayBuffer; dropped: boolean };

function formatSeconds(value: number) {
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
}

export function Recorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [quality, setQuality] = useState<AudioQuality>();
  const [dsp, setDsp] = useState<DspSummary>();
  const [waveform, setWaveform] = useState<number[]>();
  const [input, setInput] = useState<InputInfo>();
  const [message, setMessage] = useState<string>();
  const [analysis, setAnalysis] = useState<LocalAnalysis>();
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

  async function inspectPcm(pcm: Float32Array, sampleRate: number, source: string) {
    setState("checking");
    try {
      const result = await new Promise<{ quality: AudioQuality; dsp?: DspSummary; waveform: number[] }>((resolve, reject) => {
        const worker = new Worker(new URL("../../workers/quality.worker.ts", import.meta.url));
        worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
        worker.onerror = () => { worker.terminate(); reject(new Error("품질 검사를 시작할 수 없습니다.")); };
        worker.postMessage({ pcm: pcm.buffer, sampleRate }, [pcm.buffer]);
      });
      setInput({ sampleRate, durationSeconds: result.quality.durationSeconds, source });
      setQuality(result.quality);
      setDsp(result.dsp);
      setWaveform(result.waveform);
      setMessage(result.quality.issues[0]);
      setState("ready");
    } catch {
      setMessage("지원하지 않는 파일이거나 음성을 읽을 수 없습니다.");
      setState("error");
    }
  }

  async function inspectBlob(blob: Blob, source: string) {
    try {
      const decodeContext = new AudioContext();
      const buffer = await decodeContext.decodeAudioData(await blob.arrayBuffer());
      const mono = new Float32Array(buffer.length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / buffer.numberOfChannels;
      }
      await decodeContext.close();
      await inspectPcm(mono, buffer.sampleRate, source);
    } catch {
      setMessage("지원하지 않는 파일이거나 음성을 읽을 수 없습니다.");
      setState("error");
    }
  }

  async function startRecording() {
    setMessage(undefined);
    setQuality(undefined);
    setDsp(undefined);
    setWaveform(undefined);
    setAnalysis(undefined);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = media;
      const audio = new AudioContext();
      context.current = audio;
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      const source = audio.createMediaStreamSource(media);
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const draw = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        samples.forEach((sample) => { const normalized = (sample - 128) / 128; sum += normalized * normalized; });
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
        meter.current = window.requestAnimationFrame(draw);
      };
      draw();
      let capturedPcm: Promise<CapturedPcm> | undefined;
      let captureNode: AudioWorkletNode | undefined;
      try {
        await audio.audioWorklet.addModule(new URL("../../worklets/capture.worklet.js", import.meta.url));
        captureNode = new AudioWorkletNode(audio, "pcm-capture");
        const silentOutput = audio.createGain();
        silentOutput.gain.value = 0;
        source.connect(captureNode).connect(silentOutput).connect(audio.destination);
        capturedPcm = new Promise((resolve) => {
          captureNode!.port.onmessage = ({ data }: MessageEvent<CapturedPcm & { type: string }>) => {
            if (data.type === "pcm") resolve(data);
          };
        });
      } catch {
        // Older browsers keep the local MediaRecorder/decode fallback.
      }
      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
      const activeRecorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      activeRecorder.onstop = () => {
        if (captureNode && capturedPcm) {
          captureNode.port.postMessage({ type: "flush" });
          void capturedPcm.then(({ pcm, dropped }) => {
            stopTracks();
            if (dropped) setMessage("60초를 초과한 녹음은 분석할 수 없습니다.");
            void inspectPcm(new Float32Array(pcm), audio.sampleRate, "마이크 녹음");
          });
          return;
        }
        stopTracks();
        void inspectBlob(new Blob(chunks, { type: activeRecorder.mimeType }), "마이크 녹음");
      };
      startedAt.current = Date.now();
      setElapsed(0);
      timer.current = window.setInterval(() => {
        const nextElapsed = (Date.now() - startedAt.current) / 1000;
        setElapsed(nextElapsed);
        if (nextElapsed >= 60 && activeRecorder.state === "recording") activeRecorder.stop();
      }, 250);
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
    if (file) void inspectBlob(file, "로컬 파일");
  }

  function startAnalysis() {
    if (!input || !quality || !dsp) return;
    setAnalysis(createLocalAnalysis({ sampleRate: input.sampleRate, durationSeconds: input.durationSeconds, effectiveVoiceSeconds: input.durationSeconds * quality.voicedRatio }, quality, dsp, brand.appVersion, brand.dspVersion));
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
      {quality && input && <dl className="quality"><div><dt>길이</dt><dd>{input.durationSeconds.toFixed(1)}초</dd></div><div><dt>입력 음량</dt><dd>{Math.round(quality.rms * 100)}%</dd></div><div><dt>clipping</dt><dd>{(quality.clippingRatio * 100).toFixed(2)}%</dd></div><div><dt>유성음</dt><dd>{Math.round(quality.voicedRatio * 100)}%</dd></div>{dsp?.f0MedianHz && <div><dt>F0 중앙값</dt><dd>{Math.round(dsp.f0MedianHz)}Hz</dd></div>}{dsp?.spectralCentroidHz && <div><dt>스펙트럼 중심</dt><dd>{Math.round(dsp.spectralCentroidHz)}Hz</dd></div>}</dl>}
      {waveform && <svg aria-label="입력 파형" className="waveform" viewBox="0 0 120 100" role="img">{waveform.map((peak, index) => <line key={index} x1={index + 0.5} x2={index + 0.5} y1={50 - peak * 45} y2={50 + peak * 45} />)}</svg>}
      <button disabled={!canAnalyze} onClick={startAnalysis} type="button">분석 시작</button>
      {input && <p className="metadata">{input.source} · {input.sampleRate.toLocaleString()}Hz · 이 기기에서만 처리</p>}
      {analysis && <section aria-labelledby="result-heading" className="result">
        <div><p className="eyebrow">결과</p><h2 id="result-heading">측정된 음향 특징</h2></div>
        <p>학습 모델은 아직 배포되지 않았습니다. 아래는 규칙 기반의 로컬 음향 측정입니다.</p>
        <dl className="quality"><div><dt>F0 중앙값</dt><dd>{Math.round(analysis.acousticFeatures.f0MedianHz ?? 0)}Hz</dd></div><div><dt>F0 5–95%</dt><dd>{Math.round(analysis.acousticFeatures.f0P05Hz ?? 0)}–{Math.round(analysis.acousticFeatures.f0P95Hz ?? 0)}Hz</dd></div><div><dt>스펙트럼 중심</dt><dd>{Math.round(analysis.acousticFeatures.spectralCentroidHz ?? 0)}Hz</dd></div><div><dt>입력 품질</dt><dd>{analysis.quality.score}</dd></div></dl>
        <h3>연습 제안</h3>
        <ul>{analysis.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul>
        <p className="safety">이 가이드는 음향적 연습 제안이며 의료 조언이 아닙니다. 통증 또는 불편감이 지속되면 연습을 중단하고 전문가와 상담하세요.</p>
        <div className="downloads"><button onClick={() => downloadText(JSON.stringify(analysis, null, 2), "voiceprint-result.json", "application/json")} type="button">JSON 다운로드</button><button onClick={() => downloadText(scalarCsv(analysis), "voiceprint-features.csv", "text/csv")} type="button">CSV 다운로드</button><button onClick={() => downloadSummaryPng(analysis)} type="button">PNG 다운로드</button></div>
      </section>}
    </section>
  );
}
