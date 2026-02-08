// CRITICAL
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveBinary, runCommand } from "../../command/command-utilities";
import { runCli } from "../cli/cli-runner";
import type { ImageAdapter, ImageBackend } from "./types";

const listFiles = (directory: string): string[] => {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

/**
 * Adapter for `stable-diffusion.cpp` CLI (`sd`) image generation.
 */
export class StableDiffusionCppAdapter implements ImageAdapter {
  public readonly id = "stable-diffusion.cpp";

  /**
   * Resolve the configured image generation CLI binary.
   * @returns Binary path, or null if not found.
   */
  private resolveCli(): string | null {
    const configured = (process.env["VLLM_STUDIO_IMAGE_CLI"] || "sd").trim();
    return resolveBinary(configured);
  }

  /**
   * Check whether the integration is installed (binary resolvable).
   * @returns True if installed.
   */
  public isInstalled(): boolean {
    return Boolean(this.resolveCli());
  }

  /**
   * Get the CLI version string.
   * @returns Version string, or null if unavailable.
   */
  public async getVersion(): Promise<string | null> {
    const cli = this.resolveCli();
    if (!cli) return null;
    const result = runCommand(cli, ["--version"], 2000);
    if (result.status === 0) {
      const line = (result.stdout || result.stderr).split("\n")[0]?.trim();
      return line || null;
    }
    return null;
  }

  /**
   * List discoverable image models in the models directory.
   * @param modelsDirectory - Base models directory.
   * @returns Model filenames.
   */
  public async listModels(modelsDirectory: string): Promise<string[]> {
    const directory = join(modelsDirectory, "image");
    const files = listFiles(directory);
    return files.filter((name) => name.endsWith(".gguf") || name.endsWith(".safetensors") || name.endsWith(".ckpt"));
  }

  /**
   * Report the preferred backend(s) for this integration.
   * @returns Backends.
   */
  public async getBackends(): Promise<ImageBackend[]> {
    const backend = (process.env["VLLM_STUDIO_IMAGE_BACKEND"] || "").trim().toLowerCase();
    if (backend) return [backend as ImageBackend];
    return ["cpu"];
  }

  /**
   * Generate an image via the CLI adapter.
   * @param args - Generation arguments.
   * @param args.prompt - Prompt text.
   * @param args.negativePrompt - Optional negative prompt.
   * @param args.width - Image width.
   * @param args.height - Image height.
   * @param args.steps - Diffusion steps.
   * @param args.seed - Optional seed.
   * @param args.modelPath - Model file path.
   * @param args.outputPath - Output file path.
   * @returns void
   */
  public async generate(args: {
    prompt: string;
    negativePrompt?: string | null;
    width: number;
    height: number;
    steps: number;
    seed?: number | null;
    modelPath: string;
    outputPath: string;
  }): Promise<void> {
    const cli = this.resolveCli();
    if (!cli) {
      throw new Error("Image integration not installed (missing sd CLI). Set VLLM_STUDIO_IMAGE_CLI.");
    }
    if (!existsSync(args.modelPath)) {
      throw new Error(`Image model not found: ${args.modelPath}`);
    }
    const outputDirectory = dirname(args.outputPath);
    mkdirSync(outputDirectory, { recursive: true });

    // Stable Diffusion CLI flags vary; these are a pragmatic baseline for stable-diffusion.cpp `sd`.
    const cliArguments: string[] = [
      "-m",
      args.modelPath,
      "-p",
      args.prompt,
      "-W",
      String(args.width),
      "-H",
      String(args.height),
      "--steps",
      String(args.steps),
      "-o",
      args.outputPath,
    ];
    if (args.negativePrompt) {
      cliArguments.push("--negative-prompt", args.negativePrompt);
    }
    if (typeof args.seed === "number") {
      cliArguments.push("--seed", String(args.seed));
    }

    const result = await runCli(cli, cliArguments, { timeoutMs: 600_000 });
    if (result.exitCode !== 0) {
      const details = result.stderr || result.stdout || "unknown error";
      throw new Error(`Image generation failed: ${details}`);
    }
  }
}
