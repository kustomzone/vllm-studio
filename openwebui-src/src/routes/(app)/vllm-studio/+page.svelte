<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		getHealth,
		getStatus,
		getRecipes,
		getLogFiles,
		getLogs,
		switchModel,
		evictModel,
		launchRecipe,
		createRecipe,
		updateRecipe,
		deleteRecipe,
		getGpuInfo,
		getMetrics,
		type Recipe,
		type HealthStatus,
		type SystemStatus,
		type LogFile,
		type GpuInfo,
		type PerformanceMetrics
	} from '$lib/apis/vllm-studio';
	import { WEBUI_NAME, user } from '$lib/stores';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	let health: HealthStatus | null = null;
	let status: SystemStatus | null = null;
	let recipes: Recipe[] = [];
	let logFiles: LogFile[] = [];
	let gpus: GpuInfo[] = [];
	let metrics: PerformanceMetrics | null = null;
	let currentLogs: string[] = [];
	let selectedLogRecipe: string = '';
	let loaded = false;
	let refreshInterval: ReturnType<typeof setInterval>;
	let switching = false;

	// Modal state
	let showRecipeModal = false;
	let editingRecipe: Recipe | null = null;
	let recipeForm: Partial<Recipe> = getEmptyRecipe();

	function getEmptyRecipe(): Partial<Recipe> {
		return {
			id: '',
			name: '',
			model_path: '',
			backend: 'vllm',
			tp: 1,
			pp: 1,
			dp: 1,
			max_model_len: 32768,
			gpu_memory_utilization: 0.85,
			kv_cache_dtype: 'auto',
			swap_space: 16,
			max_num_seqs: 12,
			max_num_batched_tokens: 8192,
			block_size: 32,
			enable_expert_parallel: false,
			disable_custom_all_reduce: true,
			disable_log_requests: true,
			trust_remote_code: true,
			enable_auto_tool_choice: true,
			tool_call_parser: null,
			reasoning_parser: null,
			quantization: null,
			dtype: null,
			calculate_kv_scales: false,
			cuda_visible_devices: null,
			host: '0.0.0.0',
			port: 8000,
			extra_args: {}
		};
	}

	async function loadData() {
		try {
			const token = localStorage.token || '';
			const [healthData, statusData, recipesData, logsData, gpuData, metricsData] = await Promise.all([
				getHealth(token).catch(() => null),
				getStatus(token).catch(() => null),
				getRecipes(token).catch(() => []),
				getLogFiles(token).catch(() => ({ logs: [] })),
				getGpuInfo(token).catch(() => ({ gpus: [] })),
				getMetrics(token).catch(() => null)
			]);

			health = healthData;
			status = statusData;
			recipes = recipesData || [];
			logFiles = logsData?.logs || [];
			gpus = gpuData?.gpus || [];
			metrics = metricsData;
		} catch (error) {
			console.error('Failed to load data:', error);
		} finally {
			loaded = true;
		}
	}

	async function handleLaunch(recipeId: string) {
		if (switching) return;
		switching = true;
		try {
			toast.info($i18n.t('Launching model...'));
			const result = await launchRecipe(localStorage.token || '', recipeId, true);
			if (result.success) {
				toast.success(result.message || $i18n.t('Model launched'));
			} else {
				toast.error(result.message || $i18n.t('Failed to launch'));
			}
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to launch model'));
		} finally {
			switching = false;
		}
	}

	async function handleSwitch(recipeId: string) {
		if (switching) return;
		switching = true;
		try {
			toast.info($i18n.t('Switching model...'));
			const result = await switchModel(localStorage.token || '', recipeId, true);
			if (result.success) {
				toast.success(result.message || $i18n.t('Model switched'));
			} else {
				toast.error(result.message || $i18n.t('Failed to switch'));
			}
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to switch model'));
		} finally {
			switching = false;
		}
	}

	async function handleEvict() {
		if (!confirm($i18n.t('Evict the current model?'))) return;
		if (switching) return;
		switching = true;
		try {
			toast.info($i18n.t('Evicting model...'));
			await evictModel(localStorage.token || '', true);
			toast.success($i18n.t('Model evicted'));
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to evict model'));
		} finally {
			switching = false;
		}
	}

	async function handleViewLogs(recipeId: string) {
		selectedLogRecipe = recipeId;
		try {
			const result = await getLogs(localStorage.token || '', recipeId, 200);
			currentLogs = result.logs || [];
		} catch (error: any) {
			toast.error($i18n.t('Failed to load logs'));
			currentLogs = [];
		}
	}

	function openNewRecipeModal() {
		editingRecipe = null;
		recipeForm = getEmptyRecipe();
		showRecipeModal = true;
	}

	function openEditRecipeModal(recipe: Recipe) {
		editingRecipe = recipe;
		recipeForm = { ...recipe };
		showRecipeModal = true;
	}

	async function handleSaveRecipe() {
		try {
			const token = localStorage.token || '';
			if (editingRecipe) {
				await updateRecipe(token, recipeForm.id!, recipeForm as Recipe);
				toast.success($i18n.t('Recipe updated'));
			} else {
				await createRecipe(token, recipeForm as Recipe);
				toast.success($i18n.t('Recipe created'));
			}
			showRecipeModal = false;
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to save recipe'));
		}
	}

	async function handleDeleteRecipe() {
		if (!editingRecipe || !confirm($i18n.t('Delete this recipe?'))) return;
		try {
			await deleteRecipe(localStorage.token || '', editingRecipe.id);
			toast.success($i18n.t('Recipe deleted'));
			showRecipeModal = false;
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to delete recipe'));
		}
	}

	function getModelName(path: string): string {
		return path?.split('/').pop() || 'Unknown';
	}

	function formatMemory(mb: number | undefined): string {
		if (!mb) return '0 GB';
		return (mb / 1024).toFixed(1) + ' GB';
	}

	function getMemoryPercent(used: number | undefined, total: number | undefined): number {
		if (!used || !total) return 0;
		return Math.round((used / total) * 100);
	}

	function formatThroughput(value: number | null | undefined): string {
		if (value === null || value === undefined) return '-';
		return value.toFixed(1) + ' tok/s';
	}

	onMount(() => {
		loadData();
		refreshInterval = setInterval(loadData, 5000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});
</script>

<svelte:head>
	<title>vLLM Studio - {$WEBUI_NAME}</title>
</svelte:head>

{#if loaded}
	<!-- Header -->
	<div class="flex flex-col gap-1 px-1 mt-1.5 mb-3">
		<div class="flex justify-between items-center">
			<div class="flex items-center md:self-center text-xl font-medium px-0.5 gap-2 shrink-0">
				<div>vLLM Studio</div>
				<div class="text-lg font-medium text-gray-500 dark:text-gray-500">
					{recipes.length} recipes
				</div>
			</div>

			<div class="flex w-full justify-end gap-1.5">
				<button
					class="flex text-xs items-center space-x-1 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-850 dark:hover:bg-gray-800 dark:text-gray-200 transition"
					on:click={loadData}
					disabled={switching}
				>
					<div class="self-center font-medium">Refresh</div>
				</button>

				{#if status?.running_process}
					<button
						class="flex text-xs items-center space-x-1 px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition disabled:opacity-50"
						on:click={handleEvict}
						disabled={switching}
					>
						<div class="self-center font-medium">{switching ? 'Working...' : 'Evict Model'}</div>
					</button>
				{/if}

				<button
					class="px-2 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black transition font-medium text-sm flex items-center"
					on:click={openNewRecipeModal}
				>
					<svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
					</svg>
					<div class="hidden md:block md:ml-1 text-xs">New Recipe</div>
				</button>
			</div>
		</div>
	</div>

	<!-- GPU Status Cards -->
	{#if gpus.length > 0}
		<div class="mb-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400 px-1 mb-2">GPU Status</div>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
				{#each gpus as gpu}
					<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
						<div class="flex items-center justify-between mb-2">
							<div class="text-xs font-medium text-gray-500">GPU {gpu.id}</div>
							<div class="text-xs px-1.5 py-0.5 rounded-full {gpu.temp_c && gpu.temp_c > 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : gpu.temp_c && gpu.temp_c > 65 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}">
								{gpu.temp_c ?? 0}°C
							</div>
						</div>
						<div class="text-sm font-medium text-gray-900 dark:text-white truncate mb-2" title={gpu.name}>
							{gpu.name}
						</div>
						<div class="space-y-1">
							<div class="flex items-center justify-between text-xs text-gray-500">
								<span>Memory</span>
								<span>{formatMemory(gpu.memory_used_mb)} / {formatMemory(gpu.memory_total_mb)}</span>
							</div>
							<div class="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all {getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 90 ? 'bg-red-500' : getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 70 ? 'bg-yellow-500' : 'bg-green-500'}"
									style="width: {getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb)}%"
								></div>
							</div>
							<div class="flex items-center justify-between text-xs text-gray-400">
								{#if gpu.utilization_pct !== undefined}
									<span>Util: {gpu.utilization_pct}%</span>
								{/if}
								{#if gpu.power_w}
									<span>{gpu.power_w?.toFixed(0)}W</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Status Cards -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
		<!-- Current Model -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Current Model</div>
			{#if status?.running_process}
				<div class="flex items-start gap-3">
					<div class="w-2 h-2 rounded-full bg-green-500 mt-2 shrink-0 animate-pulse"></div>
					<div class="min-w-0 flex-1">
						<div class="text-lg font-medium text-gray-900 dark:text-white truncate">
							{getModelName(status.running_process.model_path)}
						</div>
						<div class="text-sm text-gray-500 space-y-0.5 mt-1">
							<div>PID: {status.running_process.pid} | Port: {status.running_process.port}</div>
							<div>Backend: {status.running_process.backend} | Mem: {status.running_process.memory_gb?.toFixed(1)} GB</div>
						</div>
						{#if status.matched_recipe}
							<div class="mt-2 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full inline-block">
								Recipe: {status.matched_recipe.name}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<div class="w-2 h-2 rounded-full bg-gray-400 shrink-0"></div>
					<div class="text-gray-500">No model running</div>
				</div>
			{/if}
		</div>

		<!-- Performance Metrics -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Performance</div>
			{#if metrics && status?.running_process}
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-600 dark:text-gray-400">Prompt Throughput</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{formatThroughput(metrics.avg_prompt_throughput)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-600 dark:text-gray-400">Generation</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">{formatThroughput(metrics.avg_generation_throughput)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-gray-600 dark:text-gray-400">Running / Pending</span>
						<span class="text-sm font-medium text-gray-900 dark:text-white">
							{metrics.running_requests ?? 0} / {metrics.pending_requests ?? 0}
						</span>
					</div>
					{#if metrics.gpu_cache_usage !== null && metrics.gpu_cache_usage !== undefined}
						<div class="flex items-center justify-between">
							<span class="text-sm text-gray-600 dark:text-gray-400">KV Cache</span>
							<span class="text-sm font-medium text-gray-900 dark:text-white">{(metrics.gpu_cache_usage * 100).toFixed(1)}%</span>
						</div>
					{/if}
				</div>
			{:else}
				<div class="text-sm text-gray-500">No metrics available</div>
			{/if}
		</div>

		<!-- System Status -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">System Status</div>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full {health?.backend_reachable ? 'bg-green-500' : 'bg-red-500'}"></div>
					<span class="text-sm text-gray-700 dark:text-gray-300">Backend {health?.backend_reachable ? 'Online' : 'Offline'}</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full {health?.proxy_reachable ? 'bg-green-500' : 'bg-yellow-500'}"></div>
					<span class="text-sm text-gray-700 dark:text-gray-300">Proxy {health?.proxy_reachable ? 'Online' : 'Offline'}</span>
				</div>
				<div class="text-xs text-gray-500 pt-1">
					Version: {health?.version || '?'} | vLLM: {status?.vllm_port || '?'} | Proxy: {status?.proxy_port || '?'}
				</div>
			</div>
		</div>
	</div>

	<!-- Recipes List -->
	<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 mb-4">
		<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-850">
			<div class="text-sm font-medium text-gray-900 dark:text-white">Recipes</div>
		</div>

		{#if recipes.length > 0}
			<div class="divide-y divide-gray-100 dark:divide-gray-850">
				{#each recipes as recipe}
					<div class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-850/50 transition {recipe.status === 'running' ? 'border-l-2 border-l-green-500' : ''}">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900 dark:text-white">{recipe.name}</span>
								{#if recipe.status === 'running'}
									<span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
										Running
									</span>
								{:else if recipe.status === 'starting'}
									<span class="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
										Starting
									</span>
								{:else if recipe.status === 'error'}
									<span class="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
										Error
									</span>
								{/if}
							</div>
							<div class="text-xs text-gray-500 truncate mt-0.5">
								{getModelName(recipe.model_path)} | TP{recipe.tp}×PP{recipe.pp}{recipe.dp > 1 ? `×DP${recipe.dp}` : ''} | {recipe.backend} | {recipe.kv_cache_dtype}
							</div>
							{#if recipe.error_message}
								<div class="text-xs text-red-500 mt-1 truncate">{recipe.error_message}</div>
							{/if}
						</div>
						<div class="flex items-center gap-1.5">
							<Tooltip content="View Logs">
								<button
									on:click={() => handleViewLogs(recipe.id)}
									class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
								>
									<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								</button>
							</Tooltip>
							<Tooltip content="Edit Recipe">
								<button
									on:click={() => openEditRecipeModal(recipe)}
									class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
								>
									<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>
							</Tooltip>
							{#if recipe.status === 'running'}
								<button
									on:click={handleEvict}
									disabled={switching}
									class="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50"
								>
									{switching ? '...' : 'Stop'}
								</button>
							{:else}
								<button
									on:click={() => status?.running_process ? handleSwitch(recipe.id) : handleLaunch(recipe.id)}
									disabled={switching}
									class="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black text-xs font-medium rounded-lg hover:opacity-80 transition disabled:opacity-50"
								>
									{switching ? '...' : status?.running_process ? 'Switch' : 'Launch'}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="p-8 text-center">
				<div class="text-gray-400 mb-2">No recipes found</div>
				<button
					on:click={openNewRecipeModal}
					class="text-sm text-blue-500 hover:text-blue-600"
				>
					Create your first recipe
				</button>
			</div>
		{/if}
	</div>

	<!-- Logs Section -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
		<!-- Log Files List -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30">
			<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-850">
				<div class="text-sm font-medium text-gray-900 dark:text-white">Log Files</div>
			</div>
			<div class="max-h-64 overflow-y-auto">
				{#if logFiles.length > 0}
					{#each logFiles as log}
						<button
							on:click={() => handleViewLogs(log.recipe_id)}
							class="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-850/50 transition border-b border-gray-100 dark:border-gray-850 last:border-0 {selectedLogRecipe === log.recipe_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}"
						>
							<div class="font-medium text-sm text-gray-900 dark:text-white">{log.recipe_id}</div>
							<div class="text-xs text-gray-500">{(log.size / 1024).toFixed(1)} KB</div>
						</button>
					{/each}
				{:else}
					<div class="p-4 text-center text-gray-500 text-sm">No log files</div>
				{/if}
			</div>
		</div>

		<!-- Log Content -->
		<div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30">
			<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-850">
				<div class="text-sm font-medium text-gray-900 dark:text-white">
					{selectedLogRecipe ? `Logs: ${selectedLogRecipe}` : 'Log Output'}
				</div>
			</div>
			<div class="p-3 bg-gray-950 rounded-b-3xl max-h-64 overflow-y-auto font-mono text-xs">
				{#if currentLogs.length > 0}
					{#each currentLogs as line}
						<div class="py-0.5 {line.includes('ERROR') ? 'text-red-400' : line.includes('WARNING') ? 'text-yellow-400' : line.includes('INFO') ? 'text-blue-400' : 'text-gray-400'}">
							{line}
						</div>
					{/each}
				{:else}
					<div class="text-gray-600">Select a log file to view</div>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<div class="w-full h-full flex justify-center items-center py-20">
		<Spinner className="size-5" />
	</div>
{/if}

<!-- Recipe Modal -->
{#if showRecipeModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" on:click|self={() => (showRecipeModal = false)}>
		<div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
			<div class="p-4 border-b border-gray-200 dark:border-gray-800">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{editingRecipe ? 'Edit Recipe' : 'New Recipe'}
				</h3>
			</div>
			<form on:submit|preventDefault={handleSaveRecipe} class="p-4 space-y-4">
				<!-- Basic Info -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipe ID</label>
						<input
							type="text"
							bind:value={recipeForm.id}
							disabled={!!editingRecipe}
							required
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm disabled:opacity-50"
							placeholder="my-model"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
						<input
							type="text"
							bind:value={recipeForm.name}
							required
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
							placeholder="My Model"
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Path</label>
					<input
						type="text"
						bind:value={recipeForm.model_path}
						required
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						placeholder="/mnt/llm_models/..."
					/>
				</div>

				<!-- Parallelism -->
				<div class="grid grid-cols-4 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backend</label>
						<select
							bind:value={recipeForm.backend}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						>
							<option value="vllm">vLLM</option>
							<option value="sglang">SGLang</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TP</label>
						<input
							type="number"
							bind:value={recipeForm.tp}
							min="1"
							max="8"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PP</label>
						<input
							type="number"
							bind:value={recipeForm.pp}
							min="1"
							max="8"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DP</label>
						<input
							type="number"
							bind:value={recipeForm.dp}
							min="1"
							max="8"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
				</div>

				<!-- Memory Settings -->
				<div class="grid grid-cols-3 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Model Len</label>
						<input
							type="number"
							bind:value={recipeForm.max_model_len}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GPU Memory %</label>
						<input
							type="number"
							bind:value={recipeForm.gpu_memory_utilization}
							step="0.01"
							min="0.1"
							max="0.99"
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">KV Cache Dtype</label>
						<select
							bind:value={recipeForm.kv_cache_dtype}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						>
							<option value="auto">auto</option>
							<option value="fp8">fp8</option>
							<option value="fp8_e4m3">fp8_e4m3</option>
						</select>
					</div>
				</div>

				<!-- Batching -->
				<div class="grid grid-cols-4 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Swap Space</label>
						<input
							type="number"
							bind:value={recipeForm.swap_space}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Seqs</label>
						<input
							type="number"
							bind:value={recipeForm.max_num_seqs}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Tokens</label>
						<input
							type="number"
							bind:value={recipeForm.max_num_batched_tokens}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Block Size</label>
						<input
							type="number"
							bind:value={recipeForm.block_size}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						/>
					</div>
				</div>

				<!-- Tool Calling -->
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tool Call Parser</label>
						<input
							type="text"
							bind:value={recipeForm.tool_call_parser}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
							placeholder="hermes, glm45, minimax_m2..."
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantization</label>
						<input
							type="text"
							bind:value={recipeForm.quantization}
							class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
							placeholder="auto-round, awq..."
						/>
					</div>
				</div>

				<!-- Feature Flags -->
				<div class="flex flex-wrap gap-4">
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={recipeForm.trust_remote_code} class="rounded" />
						<span class="text-sm text-gray-700 dark:text-gray-300">Trust Remote Code</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={recipeForm.enable_auto_tool_choice} class="rounded" />
						<span class="text-sm text-gray-700 dark:text-gray-300">Auto Tool Choice</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={recipeForm.enable_expert_parallel} class="rounded" />
						<span class="text-sm text-gray-700 dark:text-gray-300">Expert Parallel</span>
					</label>
				</div>

				<div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
					<button
						type="button"
						on:click={() => (showRecipeModal = false)}
						class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
					>
						Cancel
					</button>
					{#if editingRecipe}
						<button
							type="button"
							on:click={handleDeleteRecipe}
							class="px-3 py-1.5 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition"
						>
							Delete
						</button>
					{/if}
					<button
						type="submit"
						class="px-3 py-1.5 text-sm bg-black text-white dark:bg-white dark:text-black rounded-xl font-medium hover:opacity-80 transition"
					>
						Save
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
