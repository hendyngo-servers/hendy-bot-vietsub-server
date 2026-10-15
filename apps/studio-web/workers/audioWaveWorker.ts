/// <reference lib="webworker" />
type WaveMessage = { type: 'sample'; samples: Float32Array; bars: number };
const worker = self as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<WaveMessage>) => {
  const { type, samples, bars } = event.data;
  if (type !== 'sample' || !samples.length || !Number.isInteger(bars) || bars < 1) return;
  const stride = Math.max(1, Math.floor(samples.length / bars)); const result = new Float32Array(bars);
  for (let i = 0; i < bars; i++) { let peak = 0; for (let j = i * stride; j < Math.min(samples.length, (i + 1) * stride); j++) peak = Math.max(peak, Math.abs(samples[j])); result[i] = peak; }
  worker.postMessage({ type: 'waveform', bars: result }, [result.buffer]);
};
export {};
