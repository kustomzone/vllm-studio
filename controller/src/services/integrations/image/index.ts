// CRITICAL
import type { ImageAdapter } from "./types";
import { StableDiffusionCppAdapter } from "./stable-diffusion-cpp-adapter";

export const getImageAdapter = (): ImageAdapter => new StableDiffusionCppAdapter();

