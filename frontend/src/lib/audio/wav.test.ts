import { describe, expect, it } from "vitest";
import { downsampleTo, encodePcm16Wav } from "./wav";

describe("audio/wav", () => {
  it("downsamples to the expected length", () => {
    const inputRate = 48000;
    const targetRate = 16000;
    const seconds = 1;
    const samples = new Float32Array(inputRate * seconds);
    const out = downsampleTo(samples, inputRate, targetRate);
    expect(out.length).toBe(targetRate * seconds);
  });

  it("encodes a valid RIFF/WAVE header", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const res = encodePcm16Wav({ samples, sampleRate: 16000 });
    const text = (start: number, len: number) =>
      String.fromCharCode(...res.wavBytes.slice(start, start + len));

    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(text(36, 4)).toBe("data");
    expect(res.wavBytes.length).toBe(44 + samples.length * 2);
  });
});

