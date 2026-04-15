// CRITICAL
/**
 * Upper bound for how long the UI will wait on a single chat run without killing the stream.
 * Large models can sit for a long time between SSE events (prefill, tool gaps, etc.).
 */
export const CHAT_STREAM_MAX_SILENCE_MINUTES = 210;

export const CHAT_STREAM_MAX_SILENCE_MS = CHAT_STREAM_MAX_SILENCE_MINUTES * 60 * 1000;

/** Same cap: gap allowed after `turn_end` before we assume `run_end` is missing. */
export const CHAT_RUN_END_GRACE_MS = CHAT_STREAM_MAX_SILENCE_MS;

/**
 * Soft "stalled" indicator while loading — slightly below the hard idle timeout so we do not
 * flash "stalled" and abort in the same tick.
 */
export const CHAT_STREAM_STALL_WARN_MS = CHAT_STREAM_MAX_SILENCE_MS - 90_000;
