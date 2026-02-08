// CRITICAL
import type { SttAdapter } from "./types";
import { WhisperCppAdapter } from "./whispercpp-adapter";

export const getSttAdapter = (): SttAdapter => new WhisperCppAdapter();

