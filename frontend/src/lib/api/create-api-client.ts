import { createChatsApi } from "./chats";
import { createApiCore } from "./core";
import { createLogsApi } from "./logs";
import { createMcpApi } from "./mcp";
import { createRecipesApi } from "./recipes";
import { createServicesApi } from "./services";
import { createStudioApi } from "./studio";
import { createSystemApi } from "./system";
import { createImagesApi } from "./images";
import { createJobsApi } from "./jobs";

export function createApiClient(params: { baseUrl: string; useProxy: boolean }) {
  const core = createApiCore(params);
  const api = {
    ...createSystemApi(core),
    ...createRecipesApi(core),
    ...createServicesApi(core),
    ...createImagesApi(core),
    ...createJobsApi(core),
    ...createChatsApi(core),
    ...createMcpApi(core),
    ...createLogsApi(core),
    ...createStudioApi(core),
  };

  return {
    ...api,
    evictModel: (force = false) => api.evict(force),
    exportRecipes: async (): Promise<{ content: unknown }> => {
      const { recipes } = await api.getRecipes();
      return { content: { recipes } };
    },
  };
}
