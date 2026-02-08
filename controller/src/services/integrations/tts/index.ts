// CRITICAL
import type { TtsAdapter } from "./types";
import { PiperAdapter } from "./piper-adapter";

export const getTtsAdapter = (): TtsAdapter => new PiperAdapter();

