// CRITICAL
export type ImageBackend = "cpu" | "cuda" | "vulkan" | "rocm" | (string & {});

export interface ImageAdapter {
  id: string;
  isInstalled(): boolean;
  getVersion(): Promise<string | null>;
  listModels(modelsDirectory: string): Promise<string[]>;
  getBackends(): Promise<ImageBackend[]>;
  generate(args: {
    prompt: string;
    negativePrompt?: string | null;
    width: number;
    height: number;
    steps: number;
    seed?: number | null;
    modelPath: string;
    outputPath: string;
  }): Promise<void>;
}
