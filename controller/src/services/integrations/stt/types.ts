// CRITICAL
export type SttBackend = "cpu" | "cuda" | "vulkan" | "rocm" | (string & {});

export interface SttAdapter {
  id: string;
  isInstalled(): boolean;
  getVersion(): Promise<string | null>;
  listModels(modelsDirectory: string): Promise<string[]>;
  getBackends(): Promise<SttBackend[]>;
  transcribe(args: {
    audioPath: string;
    modelPath: string;
    language?: string | null;
  }): Promise<{ text: string }>;
}
