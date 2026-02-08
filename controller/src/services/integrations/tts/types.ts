// CRITICAL
export type TtsBackend = "cpu" | "cuda" | "vulkan" | "rocm" | (string & {});

export interface TtsAdapter {
  id: string;
  isInstalled(): boolean;
  getVersion(): Promise<string | null>;
  listModels(modelsDirectory: string): Promise<string[]>;
  getBackends(): Promise<TtsBackend[]>;
  speak(args: {
    text: string;
    modelPath: string;
    outputPath: string;
  }): Promise<void>;
}
