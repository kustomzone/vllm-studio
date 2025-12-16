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
  MCPServer,
  MCPTool,
  MCPResource,
  Skill,
} from './types';

// Use proxy route for client-side requests (adds API key server-side)
// Direct backend URL only used for server-side calls
const isServer = typeof window === 'undefined';
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || '';

// Client-side uses /api/proxy, server-side can call backend directly
const getBaseUrl = () => {
  if (isServer) {
    return BACKEND_URL;
  }
  // Client-side: use the proxy route
  return '/api/proxy';
};

class APIClient {
  private baseUrl: string;
  private apiKey: string;
  private useProxy: boolean;

  constructor(baseUrl: string, apiKey: string, useProxy = false) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.useProxy = useProxy;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      // Only add auth header if we have an API key and not using proxy
      ...(!this.useProxy && this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      ...options.headers,
    };

    // Remove leading slash from endpoint when using proxy
    const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = this.useProxy ? `${this.baseUrl}/${path}` : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || error.error?.message || `HTTP ${response.status}`);
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

  async getChatSession(sessionId: string): Promise<{ session: ChatSession }> {
    const data = await this.request<ChatSession>(`/chats/${sessionId}`);
    return { session: data };
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    return this.request(`/chats/${sessionId}`, { method: 'DELETE' });
  }

  async updateChatSession(sessionId: string, params: { title?: string; model?: string }): Promise<{ status: string }> {
    const searchParams = new URLSearchParams();
    if (params.title) searchParams.set('title', params.title);
    if (params.model) searchParams.set('model', params.model);
    const suffix = searchParams.toString();
    return this.request(`/chats/${sessionId}${suffix ? `?${suffix}` : ''}`, { method: 'PUT' });
  }

  async addChatMessage(sessionId: string, message: {
    id?: string;
    role: string;
    content: string;
    model?: string;
    tool_calls?: unknown[] | null;
    request_prompt_tokens?: number | null;
    request_tools_tokens?: number | null;
    request_total_input_tokens?: number | null;
    request_completion_tokens?: number | null;
    estimated_cost_usd?: number | null;
  }): Promise<ChatMessage> {
    return this.request(`/chats/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async tokenizeChatCompletions(req: { model: string; messages: unknown[]; tools?: unknown[] }): Promise<{
    input_tokens: number;
    breakdown: { messages: number; tools?: number };
  }> {
    return this.request('/v1/chat/completions/tokenize', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async countTextTokens(req: { model: string; text: string }): Promise<{ num_tokens: number; breakdown?: unknown }> {
    return this.request('/v1/tokens/count', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async forkChatSession(sessionId: string, params?: { title?: string; model?: string; message_id?: string }): Promise<{ session: ChatSession }> {
    const res = await this.request<ChatSession>(`/chats/${sessionId}/fork`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
    return { session: res };
  }

  async getChatUsage(sessionId: string): Promise<{
    session_id: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd?: number | null;
  }> {
    return this.request(`/chats/${sessionId}/usage`);
  }

  async getOpenAIModels(): Promise<{ object: string; data: Array<{ id: string; root?: string; max_model_len?: number }> }> {
    return this.request('/v1/models');
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

  // MCP (Model Context Protocol)
  async getMCPServers(): Promise<MCPServer[]> {
    const data = await this.request<{ servers: MCPServer[] } | MCPServer[]>('/mcp/servers');
    if (Array.isArray(data)) return data;
    return data.servers || [];
  }

  async addMCPServer(server: { name: string; command: string; args?: string[]; env?: Record<string, string> }): Promise<{ status: string; server: string }> {
    return this.request('/mcp/servers', {
      method: 'POST',
      body: JSON.stringify(server),
    });
  }

  async updateMCPServer(
    name: string,
    update: { command?: string; args?: string[]; env?: Record<string, string>; enabled?: boolean }
  ): Promise<{ status: string; server: string }> {
    return this.request(`/mcp/servers/${name}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  async removeMCPServer(name: string): Promise<{ status: string; server: string }> {
    return this.request(`/mcp/servers/${name}`, { method: 'DELETE' });
  }

  async getMCPTools(server?: string): Promise<{ tools: MCPTool[] }> {
    const params = server ? `?server=${server}` : '';
    return this.request(`/mcp/tools${params}`);
  }

  async callMCPTool(server: string, toolName: string, args?: Record<string, unknown>): Promise<{ result: string }> {
    return this.request(`/mcp/tools/${server}/${toolName}`, {
      method: 'POST',
      body: JSON.stringify(args || {}),
    });
  }

  async getMCPResources(server?: string): Promise<{ resources: MCPResource[] }> {
    const params = server ? `?server=${server}` : '';
    return this.request(`/mcp/resources${params}`);
  }

  async readMCPResource(server: string, uri: string): Promise<{ content: string }> {
    return this.request(`/mcp/resources/${server}?uri=${encodeURIComponent(uri)}`);
  }

  // Skills
  async getSkills(): Promise<{ skills: Skill[] }> {
    return this.request('/skills');
  }

  async applySkill(skillId: string, input: string, params?: Record<string, string>): Promise<{ prompt: string; skill: string }> {
    const searchParams = new URLSearchParams({ input });
    if (params) {
      Object.entries(params).forEach(([k, v]) => searchParams.set(k, v));
    }
    return this.request(`/skills/${skillId}?${searchParams}`, { method: 'POST' });
  }
}

// Export singleton instance for client-side use (uses proxy)
export const api = new APIClient('/api/proxy', '', true);

// Export function to create server-side client with API key (direct backend access)
export function createServerAPI() {
  return new APIClient(BACKEND_URL, API_KEY, false);
}

export default api;
