/**
 * MetricsStore adapter — wraps upstream LifetimeMetricsStore.
 */
import type { LifetimeMetrics, MetricsStore, Usage } from "../interfaces";

export interface UpstreamLifetimeMetrics {
  getAll(): Record<string, number>;
  addRequests(count?: number): void;
  addPromptTokens(tokens: number): void;
  addCompletionTokens(tokens: number): void;
  addTokens(tokens: number): void;
  increment(key: string, delta: number): number;
}

export class MetricsStoreAdapter implements MetricsStore {
  private readonly upstream: UpstreamLifetimeMetrics;

  constructor(upstream: UpstreamLifetimeMetrics) {
    this.upstream = upstream;
  }

  snapshot(): LifetimeMetrics {
    const all = this.upstream.getAll();
    return {
      requestsTotal: all["requests_total"] ?? 0,
      promptTokensTotal: all["prompt_tokens_total"] ?? 0,
      completionTokensTotal: all["completion_tokens_total"] ?? 0,
      totalTokensTotal: all["tokens_total"] ?? 0,
      modelSwitchesTotal: all["model_switches_total"] ?? 0,
    };
  }

  addUsage(usage: Usage): void {
    this.upstream.addPromptTokens(usage.promptTokens);
    this.upstream.addCompletionTokens(usage.completionTokens);
    this.upstream.addTokens(usage.totalTokens);
  }

  addRequest(): void {
    this.upstream.addRequests(1);
  }

  addModelSwitch(): void {
    this.upstream.increment("model_switches_total", 1);
  }
}
