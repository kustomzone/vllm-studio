// CRITICAL

export interface VoiceAssistantTurnInput {
  job_id: string;
  // Provide either text or audio_base64. If both are provided, text wins.
  text?: string;
  audio_base64?: string;
  audio_extension?: string; // e.g. wav/mp3/m4a (used for temp file name only)
  language?: string | null;
  stt_model?: string | null;
  llm_model?: string | null;
  system?: string | null;
  tts_model?: string | null;
}

export interface VoiceAssistantTurnResult {
  transcript: string;
  response_text: string;
  audio_base64: string; // wav (for now)
  audio_mime_type: string; // audio/wav
}

