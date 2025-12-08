import { WEBUI_API_BASE_URL } from '$lib/constants';

const VLLM_STUDIO_API = `${WEBUI_API_BASE_URL}/vllm-studio`;

export interface Recipe {
	id: string;
	name: string;
	model_path: string;
	backend: string;
	// Use the alias names from backend (tp, pp, dp)
	tp: number;
	pp: number;
	dp: number;
	max_model_len: number;
	gpu_memory_utilization: number;
	kv_cache_dtype: string;
	swap_space: number;
	max_num_seqs: number;
	max_num_batched_tokens: number;
	block_size: number;
	enable_expert_parallel: boolean;
	disable_custom_all_reduce: boolean;
	disable_log_requests: boolean;
	trust_remote_code: boolean;
	enable_auto_tool_choice: boolean;
	tool_call_parser?: string | null;
	reasoning_parser?: string | null;
	quantization?: string | null;
	dtype?: string | null;
	calculate_kv_scales: boolean;
	cuda_visible_devices?: string | null;
	host: string;
	port: number;
	extra_args: Record<string, any>;
	// Status fields from RecipeWithStatus
	status?: string;
	pid?: number | null;
	error_message?: string | null;
}

export interface HealthStatus {
	status: string;
	version: string;
	running_model: string | null;
	backend_reachable: boolean;
	proxy_reachable: boolean;
}

export interface ProcessInfo {
	pid: number;
	backend: string;
	model_path: string;
	port: number;
	cmdline: string[];
	memory_gb: number;
	gpu_memory_gb: number | null;
}

export interface SystemStatus {
	running_process: ProcessInfo | null;
	matched_recipe: Recipe | null;
	vllm_port: number;
	proxy_port: number;
	recipes_count: number;
}

export interface LogFile {
	name: string;
	recipe_id: string;
	size: number;
}

export interface GpuInfo {
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

export interface PerformanceMetrics {
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
}

export interface BrowseModel {
	path: string;
	name: string;
	size_gb?: number;
	architecture?: string;
	quantization?: string;
	context_length?: number;
	num_params?: number;
	num_experts?: number;
	has_recipe: boolean;
	hidden_size?: number;
	num_layers?: number;
	vocab_size?: number;
}

export interface BrowseResult {
	path: string;
	models: BrowseModel[];
	count: number;
}

export interface RecipeExport {
	format: string;
	content: any;
	recipe_id?: string;
	count?: number;
}

export interface GeneratedRecipe {
	recipe: Recipe;
	analysis: {
		estimated_params_b: number;
		estimated_size_gb: number;
		bits_per_param: number;
		recommended_tp: number;
		recommended_ctx: number;
		num_gpus_available: number;
		gpu_memory_gb: number;
		architecture: string;
		is_moe: boolean;
		num_experts: number;
	};
}

export interface FP8Advice {
	model_path: string;
	fp8_kv_recommended: boolean;
	reasons: string[];
	expected_memory_savings?: {
		per_32k_context_mb: number;
		kv_size_fp16_mb: number;
		kv_size_fp8_mb: number;
		percent_savings: number;
	};
	compatibility: string;
	instructions?: {
		vllm_args: string;
		recipe_changes: Record<string, any>;
	};
}

export interface ContextConfig {
	context_length: number;
	kv_cache_gb: number;
	total_gb: number;
	per_gpu_gb: number;
	fits: boolean;
	utilization_pct: number;
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
	context_configs: ContextConfig[];
	model_info: {
		num_layers: number;
		hidden_size: number;
		num_kv_heads: number;
		head_dim: number;
		num_experts: number;
		max_context: number;
		kv_bytes_per_token: number;
	};
}

export interface CompatibilityCheck {
	model_path: string;
	vllm_compatible: boolean;
	sglang_compatible: boolean;
	issues: string[];
	warnings: string[];
	supported_features: string[];
	hardware?: {
		num_gpus: number;
		gpu_names: string[];
		total_vram_gb: number;
	};
}

export interface Preset {
	name: string;
	description: string;
	settings: Record<string, any>;
}

export interface BenchmarkResult {
	model_path: string;
	max_tokens: number;
	num_requests: number;
	concurrent: number;
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
}

export interface HealthSummary {
	samples: number;
	time_range_sec: number;
	avg_running_requests?: number;
	max_running_requests?: number;
	avg_kv_cache_usage_pct?: number;
	max_kv_cache_usage_pct?: number;
	avg_gpu_temp_c?: number;
	max_gpu_temp_c?: number;
	avg_gpu_power_w?: number;
}

// Health & Status
export const getHealth = async (token: string = ''): Promise<HealthStatus> => {
	const res = await fetch(`${VLLM_STUDIO_API}/health`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const getStatus = async (token: string = ''): Promise<SystemStatus> => {
	const res = await fetch(`${VLLM_STUDIO_API}/status`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Recipes
export const getRecipes = async (token: string = ''): Promise<Recipe[]> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const getRecipe = async (token: string, id: string): Promise<Recipe> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/${id}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const createRecipe = async (token: string, recipe: Recipe): Promise<Recipe> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		},
		body: JSON.stringify(recipe)
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const updateRecipe = async (token: string, id: string, recipe: Recipe): Promise<Recipe> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/${id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		},
		body: JSON.stringify(recipe)
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const deleteRecipe = async (token: string, id: string): Promise<void> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/${id}`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
};

// Model Management
export const switchModel = async (
	token: string,
	recipeId: string,
	force: boolean = false
): Promise<{ success: boolean; message: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/switch`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		},
		body: JSON.stringify({ recipe_id: recipeId, force })
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const launchRecipe = async (
	token: string,
	recipeId: string,
	force: boolean = false
): Promise<{ success: boolean; message: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/launch/${recipeId}?force=${force}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const evictModel = async (
	token: string,
	force: boolean = false
): Promise<{ status: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/evict?force=${force}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const waitForReady = async (
	token: string,
	timeout: number = 300
): Promise<{ status: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/wait-ready?timeout=${timeout}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Logs
export const getLogFiles = async (token: string = ''): Promise<{ logs: LogFile[] }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/logs`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const getLogs = async (
	token: string,
	recipeId: string,
	lines: number = 100
): Promise<{ logs: string[] }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/logs/${recipeId}?lines=${lines}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// GPU Info (interface defined at top)
export const getGpuInfo = async (token: string = ''): Promise<{ gpus: GpuInfo[]; error?: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/gpus`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Performance Metrics
export const getMetrics = async (token: string = ''): Promise<PerformanceMetrics> => {
	const res = await fetch(`${VLLM_STUDIO_API}/metrics`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Model Browser
export const browseModels = async (token: string = '', path?: string): Promise<BrowseResult> => {
	const url = path
		? `${VLLM_STUDIO_API}/browser?path=${encodeURIComponent(path)}`
		: `${VLLM_STUDIO_API}/browser`;
	const res = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Recipe Export/Import
export const exportRecipe = async (
	token: string,
	recipeId: string,
	format: string = 'json'
): Promise<RecipeExport> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/${recipeId}/export?format=${format}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const importRecipe = async (
	token: string,
	data: any,
	format: string = 'json'
): Promise<{ success: boolean; recipe_id: string; message: string }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/import?format=${format}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const exportAllRecipes = async (
	token: string = '',
	format: string = 'json'
): Promise<RecipeExport> => {
	const res = await fetch(`${VLLM_STUDIO_API}/recipes/export-all?format=${format}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Auto Recipe Generator
export const generateRecipe = async (
	token: string,
	modelPath: string,
	name?: string
): Promise<GeneratedRecipe> => {
	const params = new URLSearchParams({ model_path: modelPath });
	if (name) params.append('name', name);
	const res = await fetch(`${VLLM_STUDIO_API}/generate-recipe?${params}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// FP8 KV Cache Advisor
export const getFP8Advice = async (token: string = '', modelPath?: string): Promise<FP8Advice> => {
	const url = modelPath
		? `${VLLM_STUDIO_API}/fp8-advisor?model_path=${encodeURIComponent(modelPath)}`
		: `${VLLM_STUDIO_API}/fp8-advisor`;
	const res = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// VRAM Calculator
export const calculateVRAM = async (
	token: string = '',
	modelPath: string,
	contextLength: number = 32768,
	batchSize: number = 12,
	tpSize: number = 1,
	quantization: string = 'auto',
	kvCacheDtype: string = 'fp16'
): Promise<VRAMCalculation> => {
	const params = new URLSearchParams({
		model_path: modelPath,
		context_length: contextLength.toString(),
		batch_size: batchSize.toString(),
		tp_size: tpSize.toString(),
		quantization,
		kv_cache_dtype: kvCacheDtype
	});
	const res = await fetch(`${VLLM_STUDIO_API}/vram-calculator?${params}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Model Compatibility
export const checkCompatibility = async (
	token: string = '',
	modelPath: string
): Promise<CompatibilityCheck> => {
	const res = await fetch(
		`${VLLM_STUDIO_API}/compatibility?model_path=${encodeURIComponent(modelPath)}`,
		{
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				...(token && { Authorization: `Bearer ${token}` })
			}
		}
	);
	if (!res.ok) throw await res.json();
	return res.json();
};

// Quick Launch Presets
export const getPresets = async (
	token: string = ''
): Promise<{ presets: Record<string, Preset> }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/presets`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const applyPreset = async (
	token: string,
	recipeId: string,
	presetName: string
): Promise<{ success: boolean; recipe_id: string; preset_applied: string }> => {
	const res = await fetch(
		`${VLLM_STUDIO_API}/recipes/${recipeId}/apply-preset?preset_name=${presetName}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token && { Authorization: `Bearer ${token}` })
			}
		}
	);
	if (!res.ok) throw await res.json();
	return res.json();
};

// Benchmark
export const runBenchmark = async (
	token: string = '',
	prompt: string = 'Write a detailed essay about artificial intelligence.',
	maxTokens: number = 256,
	numRequests: number = 5,
	concurrent: number = 1
): Promise<BenchmarkResult> => {
	const params = new URLSearchParams({
		prompt,
		max_tokens: maxTokens.toString(),
		num_requests: numRequests.toString(),
		concurrent: concurrent.toString()
	});
	const res = await fetch(`${VLLM_STUDIO_API}/benchmark?${params}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

// Health Monitor
export const getHealthHistory = async (
	token: string = '',
	limit: number = 100
): Promise<{ history: any[]; count: number }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/health-history?limit=${limit}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const recordHealthSample = async (token: string = ''): Promise<{ recorded: boolean }> => {
	const res = await fetch(`${VLLM_STUDIO_API}/health-sample`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};

export const getHealthSummary = async (token: string = ''): Promise<HealthSummary> => {
	const res = await fetch(`${VLLM_STUDIO_API}/health-summary`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		}
	});
	if (!res.ok) throw await res.json();
	return res.json();
};
