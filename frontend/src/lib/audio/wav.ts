// CRITICAL
/**
 * Minimal WAV (PCM 16-bit) encoder for browser-recorded audio.
 *
 * We prefer client-side WAV so the controller STT path doesn't require ffmpeg
 * to transcode MediaRecorder formats like audio/webm.
 */

export type WavEncodeResult = {
  wavBytes: Uint8Array;
  sampleRate: number;
  numChannels: number;
  numSamples: number;
};

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

const writeString = (view: DataView, offset: number, value: string): void => {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
};

const mergeFloat32 = (chunks: Float32Array[]): Float32Array => {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
};

// Simple linear downsampler. Good enough for speech; avoids adding heavy deps.
export const downsampleTo = (
  input: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number,
): Float32Array => {
  if (targetSampleRate >= inputSampleRate) return input;
  const ratio = inputSampleRate / targetSampleRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const left = Math.floor(srcIndex);
    const right = Math.min(input.length - 1, left + 1);
    const frac = srcIndex - left;
    out[i] = input[left]! * (1 - frac) + input[right]! * frac;
  }
  return out;
};

export const encodePcm16Wav = (args: {
  samples: Float32Array;
  sampleRate: number;
  numChannels?: number;
}): WavEncodeResult => {
  const numChannels = args.numChannels ?? 1;
  const sampleRate = args.sampleRate;
  const samples = args.samples;

  // RIFF header (44 bytes) + PCM16 data
  const bytesPerSample = 2;
  const dataByteLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (PCM)
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
  view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataByteLength, true);

  // PCM samples (16-bit signed little-endian)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = clamp(samples[i] ?? 0, -1, 1);
    view.setInt16(offset, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
    offset += 2;
  }

  return {
    wavBytes: new Uint8Array(buffer),
    sampleRate,
    numChannels,
    numSamples: samples.length,
  };
};

export const encodeChunksToWav = (args: {
  chunks: Float32Array[];
  inputSampleRate: number;
  targetSampleRate?: number;
}): WavEncodeResult => {
  const merged = mergeFloat32(args.chunks);
  const target = args.targetSampleRate ?? 16000;
  const down = downsampleTo(merged, args.inputSampleRate, target);
  return encodePcm16Wav({ samples: down, sampleRate: target, numChannels: 1 });
};

