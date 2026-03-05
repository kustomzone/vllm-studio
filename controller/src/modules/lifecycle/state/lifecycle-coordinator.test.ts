/**
 * Lifecycle coordinator launch transitions tests.
 */
import { describe, expect, it } from "bun:test";
import { createLaunchState } from "./launch-state";

describe("lifecycle launch state transitions", () => {
  it("tracks launch, preempting, and idle states", () => {
    const launchState = createLaunchState();

    expect(launchState.getLaunchingRecipeId()).toBeNull();
    expect(launchState.getState().phase).toBe("idle");

    launchState.markLaunching("recipe-1");
    expect(launchState.getLaunchingRecipeId()).toBe("recipe-1");
    expect(launchState.getState().phase).toBe("launching");

    launchState.markPreempting("recipe-2");
    expect(launchState.getLaunchingRecipeId()).toBe("recipe-2");
    expect(launchState.getState().phase).toBe("preempting");

    launchState.setLaunchingRecipeId("recipe-3");
    expect(launchState.getLaunchingRecipeId()).toBe("recipe-3");
    expect(launchState.getState().phase).toBe("preempting");

    launchState.markIdle();
    expect(launchState.getLaunchingRecipeId()).toBeNull();
    expect(launchState.getState().phase).toBe("idle");

    launchState.transition({ type: "set", recipeId: null });
    expect(launchState.getState().phase).toBe("idle");
  });
});
