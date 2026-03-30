/**
 * RecipeRegistry adapter — wraps the upstream RecipeStore.
 */
import type { Recipe } from "../../modules/lifecycle/types";
import type { RecipeRegistry } from "../interfaces";

export class RecipeRegistryAdapter implements RecipeRegistry {
  private readonly upstream: {
    list(): Recipe[];
    get(id: string): Recipe | null;
    save(recipe: Recipe): void;
    delete(id: string): boolean;
  };

  constructor(upstream: {
    list(): Recipe[];
    get(id: string): Recipe | null;
    save(recipe: Recipe): void;
    delete(id: string): boolean;
  }) {
    this.upstream = upstream;
  }

  upsert(recipe: Recipe): Recipe {
    this.upstream.save(recipe);
    return recipe;
  }

  getById(recipeId: string): Recipe | undefined {
    return this.upstream.get(recipeId) ?? undefined;
  }

  getByServedModelName(name: string): Recipe | undefined {
    return this.upstream
      .list()
      .find((r) => r.served_model_name === name);
  }

  list(): Recipe[] {
    return this.upstream.list();
  }

  delete(recipeId: string): boolean {
    return this.upstream.delete(recipeId);
  }
}
