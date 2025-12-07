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
	prefill_tokens_per_sec?: number;
	decode_tokens_per_sec?: number;
	avg_prompt_throughput?: number;
	avg_generation_throughput?: number;
	running_requests?: number;
	pending_requests?: number;
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
