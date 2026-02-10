// CRITICAL
/**
 * Decode an audio Blob (e.g. MediaRecorder webm/ogg) into mono Float32 PCM samples.
 *
 * This enables client-side WAV encoding so the controller STT endpoint doesn't need ffmpeg
 * to transcode browser formats, and improves latency for interactive voice UX.
 */

export async function decodeAudioBlobToMonoSamples(
  blob: Blob,
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  try {
    const AudioContextCtor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AudioContextCtor) return null;

    const buf = await blob.arrayBuffer();
    const ctx: AudioContext = new AudioContextCtor();
    try {
      const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
      const { numberOfChannels, length, sampleRate } = audioBuffer;
      if (length <= 0) return null;

      // Mix down to mono.
      if (numberOfChannels <= 1) {
        const ch0 = audioBuffer.getChannelData(0);
        return { samples: new Float32Array(ch0), sampleRate };
      }

      const mono = new Float32Array(length);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) mono[i] += data[i] ?? 0;
      }
      const inv = 1 / numberOfChannels;
      for (let i = 0; i < mono.length; i++) mono[i] *= inv;

      return { samples: mono, sampleRate };
    } finally {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  } catch {
    return null;
  }
}

