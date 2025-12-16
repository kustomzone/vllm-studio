// Backend API Types

export interface GPU {
  id: number;
  name: string;
  uuid?: string;
  temp_c?: number;
  memory_total_mb?: number;
  memory_used_mb?: number;
  memory_free_mb?: number;
  utilization_pct?: number;
  power_w?: number;
}

export interface ProcessInfo {
  pid: number;
  model_path: string;
  backend: 'vllm' | 'sglang';
  port: number;
  memory_gb?: number;
  served_model_name?: string;
}

export interface Recipe {
  id: string;
  name: string;
  model_path: string;
  backend: 'vllm' | 'sglang';
  tp?: number;  // tensor_parallel_size
  pp?: number;  // pipeline_parallel_size
  dp?: number;  // data_parallel_size
  tensor_parallel_size?: number;  // alias
  pipeline_parallel_size?: number;  // alias
  data_parallel_size?: number;  // alias
  max_model_len?: number;
  gpu_memory_utilization?: number;
  kv_cache_dtype?: string;
  swap_space?: number;
  max_num_seqs?: number;
  max_num_batched_tokens?: number;
  block_size?: number;
  enable_expert_parallel?: boolean;
  disable_custom_all_reduce?: boolean;
  disable_log_requests?: boolean;
  trust_remote_code?: boolean;
  enable_auto_tool_choice?: boolean;
  quantization?: string;
  dtype?: string;
  tool_call_parser?: string;
  reasoning_parser?: string;
  served_model_name?: string;
  host?: string;
  port?: number;
  python_path?: string;
  venv_path?: string;
  env_vars?: Record<string, string>;
  extra_args?: Record<string, unknown>;
}

export interface RecipeWithStatus extends Recipe {
  status: 'stopped' | 'running' | 'starting' | 'stopping' | 'error';
  is_running?: boolean;
  pid?: number;
  error_message?: string;
}

export interface LogSession {
  id: string;
  model?: string;
  backend?: string;
  created_at: string;
  file_path?: string;
  size?: number;
}

export interface ModelInfo {
  path: string;
  name: string;
  size_gb?: number;
  architecture?: string;
  quantization?: string;
  context_length?: number;
  num_params?: number;
  num_experts?: number;
  hidden_size?: number;
  num_layers?: number;
  vocab_size?: number;
  has_recipe: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  running_model?: string;
  backend_reachable: boolean;
  proxy_reachable: boolean;
}

export interface Metrics {
  running_requests?: number;
  pending_requests?: number;
  kv_cache_usage?: number;
  prefix_cache_hit_rate?: number;
  prompt_tokens_total?: number;
  generation_tokens_total?: number;
  prompt_throughput?: number;
  generation_throughput?: number;
  avg_ttft_ms?: number;
  avg_tpot_ms?: number;
  request_success?: number;
  error?: string;
}

export interface LogFile {
  name: string;
  recipe_id: string;
  size: number;
  modified: number;
  path: string;
}

export interface VRAMBreakdown {
  model_weights_gb?: number;
  kv_cache_gb?: number;
  activation_gb?: number;
  overhead_gb?: number;
  total_per_gpu_gb?: number;
  fits_in_memory?: boolean;
}

export interface VRAMCalculation {
  model_path: string;
  quantization: string;
  kv_cache_dtype: string;
  context_length: number;
  batch_size: number;
  tp_size: number;
  breakdown: {
    model_weights_gb: number;
    kv_cache_gb: number;
    activations_gb: number;
    overhead_gb: number;
    total_gb: number;
    per_gpu_gb: number;
  };
  gpu_info: {
    num_gpus: number;
    memory_per_gpu_gb: number;
    total_available_gb: number;
  };
  fits: boolean;
  utilization_percent: number;
  recommendations: string[];
  context_configs: Array<{
    context_length: number;
    kv_cache_gb: number;
    total_gb: number;
    per_gpu_gb: number;
    fits: boolean;
    utilization_pct: number;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  model?: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  model?: string;
  tool_calls?: unknown[];
}

export interface UsageStats {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  by_model: Record<string, {
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }>;
}

// MCP (Model Context Protocol)
export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  server: string;
  input_schema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  server: string;
  mime_type?: string;
}

// Skills
export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  params: Record<string, string>;
}

// Tool Calling
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  // MCP-specific fields
  server?: string;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  isError?: boolean;
}

// Artifacts
export interface Artifact {
  id: string;
  type: 'html' | 'react' | 'javascript' | 'python' | 'mermaid' | 'svg';
  title: string;
  code: string;
  output?: string;
  error?: string;
  isRunning?: boolean;
}

// Chat Message with tool/artifact support
export interface EnhancedChatMessage extends ChatMessage {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  artifacts?: Artifact[];
}
