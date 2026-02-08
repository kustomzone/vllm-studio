// CRITICAL
import type { ApiCore } from "./core";

export function createImagesApi(core: ApiCore) {
  return {
    generateImage: (payload: {
      prompt: string;
      negative_prompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      seed?: number;
      model?: string;
      mode?: "strict" | "best_effort";
      replace?: boolean;
    }): Promise<{ created: number; data: Array<{ b64_json?: string }> }> =>
      core.request("/v1/images/generations", { method: "POST", body: JSON.stringify(payload) }),
  };
}

