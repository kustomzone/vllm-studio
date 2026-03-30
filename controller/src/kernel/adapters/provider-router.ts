/**
 * ProviderRouter adapter — wraps upstream provider-routing logic + RecipeRegistry.
 */
import type { Recipe } from "../../modules/lifecycle/types";
import type {
  ProviderResolution,
  ProviderRouter,
  RecipeRegistry,
} from "../interfaces";

export interface UpstreamProviderRouting {
  parseProviderModel?(rawModel: string): { provider: string; modelId: string };
}

export class ProviderRouterAdapter implements ProviderRouter {
  private readonly recipes: RecipeRegistry;
  private readonly externalProviders: Map<string, string>;

  constructor(
    recipes: RecipeRegistry,
    externalProviders?: Record<string, string>,
  ) {
    this.recipes = recipes;
    this.externalProviders = new Map(
      Object.entries(
        externalProviders ?? {
          openai: "https://api.openai.com/v1",
          anthropic: "https://api.anthropic.com/v1",
          local: "http://127.0.0.1:8000/v1",
        },
      ),
    );
  }

  resolve(
    requestedModel: string,
    fallbackProvider = "openai",
  ): ProviderResolution {
    // 1. Check by recipe id
    const byId = this.recipes.getById(requestedModel);
    if (byId) {
      return this.managedResolution(requestedModel, byId);
    }

    // 2. Check by served_model_name
    const byName = this.recipes.getByServedModelName(requestedModel);
    if (byName) {
      return this.managedResolution(requestedModel, byName);
    }

    // 3. Parse "provider/model" notation
    const parsed = this.parseProviderModel(requestedModel, fallbackProvider);
    return {
      kind: "external",
      provider: parsed.provider,
      requestedModel,
      resolvedModel: parsed.model,
      baseUrl: this.externalProviders.get(parsed.provider),
    };
  }

  private managedResolution(
    requestedModel: string,
    recipe: Recipe,
  ): ProviderResolution {
    return {
      kind: "managed",
      provider: "local",
      requestedModel,
      resolvedModel: recipe.served_model_name ?? recipe.id,
      recipe,
    };
  }

  private parseProviderModel(
    input: string,
    fallbackProvider: string,
  ): { provider: string; model: string } {
    const slash = input.indexOf("/");
    if (slash > 0) {
      const maybeProvider = input.slice(0, slash);
      const maybeModel = input.slice(slash + 1);
      if (this.externalProviders.has(maybeProvider) && maybeModel) {
        return { provider: maybeProvider, model: maybeModel };
      }
    }
    return { provider: fallbackProvider, model: input };
  }
}
