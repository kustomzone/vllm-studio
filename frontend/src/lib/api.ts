import type {
  GPU,
  ProcessInfo,
  Recipe,
  RecipeWithStatus,
  ModelInfo,
  HealthResponse,
  Metrics,
  LogFile,
  LogSession,
  VRAMCalculation,
  VRAMBreakdown,
  ChatSession,
  ChatMessage,
  UsageStats,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || '';

class APIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : (null as unknown as T);
  }

  // Health & Status
  async getHealth(): Promise<HealthResponse> {
    return this.request('/health');
  }

  async getStatus(): Promise<{
    running_process: ProcessInfo | null;
    matched_recipe: Recipe | null;
    vllm_port: number;
    proxy_port: number;
    recipes_count: number;
  }> {
    return this.request('/status');
  }

  // GPUs
  async getGPUs(): Promise<{ gpus: GPU[]; error?: string }> {
    return this.request('/gpus');
  }

  // Metrics
  async getMetrics(): Promise<Metrics> {
    return this.request('/metrics');
  }

  // Recipes
  async getRecipes(): Promise<{ recipes: RecipeWithStatus[] }> {
    const data = await this.request<RecipeWithStatus[] | { recipes: RecipeWithStatus[] }>('/recipes');
    // Handle both array and object responses
    if (Array.isArray(data)) {
      return { recipes: data };
    }
    return data;
  }

  async getRecipe(id: string): Promise<RecipeWithStatus> {
    return this.request(`/recipes/${id}`);
  }

  async createRecipe(recipe: Recipe): Promise<Recipe> {
    return this.request('/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  }

  async updateRecipe(id: string, recipe: Recipe): Promise<Recipe> {
    return this.request(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(recipe),
    });
  }

  async deleteRecipe(id: string): Promise<void> {
    return this.request(`/recipes/${id}`, { method: 'DELETE' });
  }

  // Models
  async getModels(): Promise<{ path: string; models: ModelInfo[]; count: number }> {
    return this.request('/browser');
  }

  async getRunningModel(): Promise<ProcessInfo | null> {
    return this.request('/models/running');
  }

  // Model Operations
  async switchModel(recipeId: string, force = false): Promise<{
    success: boolean;
    message: string;
    old_recipe?: string;
    new_recipe: string;
    pid?: number;
  }> {
    return this.request('/switch', {
      method: 'POST',
      body: JSON.stringify({ recipe_id: recipeId, force }),
    });
  }

  async evictModel(force = false): Promise<{ status: string; model?: string }> {
    return this.request(`/evict?force=${force}`, { method: 'POST' });
  }

  // Logs
  async getLogFiles(): Promise<{ logs: LogFile[] }> {
    return this.request('/logs');
  }

  async getLogs(recipeId: string, lines = 100): Promise<{ logs: string[]; file?: string; error?: string }> {
    return this.request(`/logs/${recipeId}?lines=${lines}`);
  }

  async getLogSessions(): Promise<{ sessions: LogSession[] }> {
    const data = await this.request<{ logs: LogFile[] }>('/logs');
    // Transform log files to log sessions
    const sessions: LogSession[] = (data.logs || []).map((log) => ({
      id: log.recipe_id || log.name,
      model: log.name.replace('.log', ''),
      created_at: new Date(log.modified * 1000).toISOString(),
      file_path: log.path,
      size: log.size,
    }));
    return { sessions };
  }

  async getLogContent(sessionId: string): Promise<{ content: string }> {
    const data = await this.request<{ logs: string[] }>(`/logs/${sessionId}?lines=1000`);
    return { content: (data.logs || []).join('\n') };
  }

  async deleteLogSession(sessionId: string): Promise<void> {
    // Note: This might need backend implementation
    return this.request(`/logs/${sessionId}`, { method: 'DELETE' });
  }

  // VRAM Calculator
  async calculateVRAM(params: {
    model_path: string;
    context_length?: number;
    batch_size?: number;
    tp_size?: number;
    quantization?: string;
    kv_cache_dtype?: string;
  }): Promise<VRAMCalculation> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    return this.request(`/vram-calculator?${searchParams}`);
  }

  // Recipe Generator
  async generateRecipe(modelPath: string, name?: string): Promise<{
    recipe: Recipe;
    analysis: Record<string, unknown>;
  }> {
    const params = new URLSearchParams({ model_path: modelPath });
    if (name) params.set('name', name);
    return this.request(`/generate-recipe?${params}`, { method: 'POST' });
  }

  // Presets
  async getPresets(): Promise<{
    presets: Record<string, {
      name: string;
      description: string;
      settings: Record<string, unknown>;
    }>;
  }> {
    return this.request('/presets');
  }

  // Benchmark
  async runBenchmark(params?: {
    prompt?: string;
    max_tokens?: number;
    num_requests?: number;
    concurrent?: number;
  }): Promise<{
    model_path: string;
    latencies_ms: number[];
    ttft_ms: number[];
    generation_tokens: number[];
    errors: number;
    stats?: {
      avg_latency_ms: number;
      min_latency_ms: number;
      max_latency_ms: number;
      avg_ttft_ms?: number;
      total_tokens: number;
      tokens_per_sec: number;
      success_rate: number;
    };
  }> {
    return this.request('/benchmark', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  // Usage Stats
  async getUsage(windowSeconds?: number): Promise<UsageStats> {
    const params = windowSeconds ? `?window_seconds=${windowSeconds}` : '';
    return this.request(`/v1/usage${params}`);
  }

  // Chat Sessions
  async getChatSessions(): Promise<{ sessions: ChatSession[] }> {
    const data = await this.request<ChatSession[]>(`/chats?limit=50`);
    return { sessions: Array.isArray(data) ? data : [] };
  }

  async createChatSession(params: { title?: string; model?: string }): Promise<{ session: ChatSession }> {
    const searchParams = new URLSearchParams();
    if (params.title) searchParams.set('title', params.title);
    if (params.model) searchParams.set('model', params.model);
    const session = await this.request<ChatSession>(`/chats?${searchParams}`, { method: 'POST' });
    return { session };
  }

  async getChatSession(sessionId: string): Promise<{ messages: ChatMessage[] }> {
    const data = await this.request<ChatSession>(`/chats/${sessionId}`);
    return { messages: data.messages || [] };
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    return this.request(`/chats/${sessionId}`, { method: 'DELETE' });
  }

  async addChatMessage(sessionId: string, message: {
    role: string;
    content: string;
    model?: string;
  }): Promise<ChatMessage> {
    return this.request(`/chats/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Legacy aliases
  async listChats(limit = 50): Promise<ChatSession[]> {
    const data = await this.getChatSessions();
    return data.sessions;
  }

  async createChat(title = 'New Chat', model?: string): Promise<ChatSession> {
    const data = await this.createChatSession({ title, model });
    return data.session;
  }

  async getChat(sessionId: string): Promise<ChatSession> {
    return this.request(`/chats/${sessionId}`);
  }

  async deleteChat(sessionId: string): Promise<void> {
    return this.deleteChatSession(sessionId);
  }

  async addMessage(sessionId: string, message: {
    role: string;
    content: string;
    model?: string;
    tool_calls?: unknown[];
  }): Promise<ChatMessage> {
    return this.addChatMessage(sessionId, message);
  }

  // Export/Import
  async exportRecipes(): Promise<{ format: string; content: unknown; count: number }> {
    return this.request('/recipes/export-all');
  }

  async importRecipe(recipe: Recipe): Promise<{ success: boolean; recipe_id: string }> {
    return this.request('/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ content: recipe }),
    });
  }
}

// Export singleton instance for client-side use
export const api = new APIClient(API_URL, '');

// Export function to create server-side client with API key
export function createServerAPI() {
  return new APIClient(API_URL, API_KEY);
}

export default api;
