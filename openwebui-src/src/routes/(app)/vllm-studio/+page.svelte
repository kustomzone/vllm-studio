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
		browseModels,
		generateRecipe,
		getFP8Advice,
		calculateVRAM,
		checkCompatibility,
		exportRecipe,
		importRecipe,
		exportAllRecipes,
		getPresets,
		applyPreset,
		runBenchmark,
		type Recipe,
		type HealthStatus,
		type SystemStatus,
		type LogFile,
		type GpuInfo,
		type PerformanceMetrics,
		type BrowseModel,
		type GeneratedRecipe,
		type FP8Advice,
		type VRAMCalculation,
		type CompatibilityCheck,
		type Preset,
		type BenchmarkResult
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

	// Tab state
	let activeTab: 'overview' | 'recipes' | 'logs' | 'models' | 'tools' = 'overview';

	// Collapsible sections
	let showGpuSection = true;
	let showMetricsSection = true;

	// Recipe filtering
	let recipeSearchQuery = '';

	// Model Browser state
	let availableModels: BrowseModel[] = [];
	let modelsLoading = false;
	let modelSearchQuery = '';

	// Auto-Recipe Generator state
	let showGenerateModal = false;
	let generateModelPath = '';
	let generateName = '';
	let generatedRecipe: GeneratedRecipe | null = null;
	let generating = false;

	// Tools state
	let fp8Advice: FP8Advice | null = null;
	let vramCalc: VRAMCalculation | null = null;
	let compatCheck: CompatibilityCheck | null = null;
	let toolsModelPath = '';
	let toolsLoading = false;
	let toolsTpSize = 8; // Default to 8 GPUs, will auto-detect
	let toolsContextLen = 32768;
	let toolsBatchSize = 12;
	let toolsKvCacheDtype: 'fp16' | 'fp8' = 'fp16';

	// Presets state
	let presets: Record<string, Preset> = {};
	let showPresetsModal = false;
	let selectedRecipeForPreset = '';

	// Benchmark state
	let showBenchmarkModal = false;
	let benchmarkPrompt = 'Write a detailed essay about artificial intelligence.';
	let benchmarkMaxTokens = 256;
	let benchmarkNumRequests = 5;
	let benchmarkConcurrent = 1;
	let benchmarkResult: BenchmarkResult | null = null;
	let benchmarking = false;

	// Import/Export state
	let showImportModal = false;
	let importData = '';

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
			// Auto-set TP size based on detected GPUs
			if (gpus.length > 0) {
				toolsTpSize = gpus.length;
			}
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

	// Model Browser functions
	async function loadModels() {
		modelsLoading = true;
		try {
			const result = await browseModels(localStorage.token || '');
			availableModels = result.models || [];
		} catch (error: any) {
			toast.error($i18n.t('Failed to load models'));
		} finally {
			modelsLoading = false;
		}
	}

	$: filteredModels = availableModels.filter(m =>
		m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
		(m.architecture && m.architecture.toLowerCase().includes(modelSearchQuery.toLowerCase()))
	);

	$: filteredRecipes = recipes.filter(r =>
		r.name.toLowerCase().includes(recipeSearchQuery.toLowerCase()) ||
		r.id.toLowerCase().includes(recipeSearchQuery.toLowerCase()) ||
		r.model_path.toLowerCase().includes(recipeSearchQuery.toLowerCase())
	);

	$: runningRecipe = recipes.find(r => r.status === 'running');

	// Auto-Recipe Generator functions
	async function handleGenerateRecipe() {
		if (!generateModelPath) return;
		generating = true;
		generatedRecipe = null;
		try {
			const result = await generateRecipe(localStorage.token || '', generateModelPath, generateName || undefined);
			generatedRecipe = result;
			toast.success($i18n.t('Recipe generated'));
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to generate recipe'));
		} finally {
			generating = false;
		}
	}

	async function handleSaveGeneratedRecipe() {
		if (!generatedRecipe?.recipe) return;
		try {
			await createRecipe(localStorage.token || '', generatedRecipe.recipe as Recipe);
			toast.success($i18n.t('Recipe saved'));
			showGenerateModal = false;
			generatedRecipe = null;
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to save recipe'));
		}
	}

	function openGenerateFromModel(model: BrowseModel) {
		generateModelPath = model.path;
		generateName = model.name;
		generatedRecipe = null;
		showGenerateModal = true;
	}

	// Tools functions
	async function analyzeModel() {
		if (!toolsModelPath) return;
		toolsLoading = true;
		fp8Advice = null;
		vramCalc = null;
		compatCheck = null;
		try {
			const [fp8, vram, compat] = await Promise.all([
				getFP8Advice(localStorage.token || '', toolsModelPath).catch(() => null),
				calculateVRAM(localStorage.token || '', toolsModelPath, toolsContextLen, toolsBatchSize, toolsTpSize, 'auto', toolsKvCacheDtype).catch(() => null),
				checkCompatibility(localStorage.token || '', toolsModelPath).catch(() => null)
			]);
			fp8Advice = fp8;
			vramCalc = vram;
			compatCheck = compat;
		} catch (error: any) {
			toast.error($i18n.t('Failed to analyze model'));
		} finally {
			toolsLoading = false;
		}
	}

	// Reactive recalculation when settings change
	async function recalculateVRAM() {
		if (!toolsModelPath || !vramCalc) return;
		try {
			vramCalc = await calculateVRAM(localStorage.token || '', toolsModelPath, toolsContextLen, toolsBatchSize, toolsTpSize, 'auto', toolsKvCacheDtype);
		} catch (error) {
			console.error('Failed to recalculate VRAM:', error);
		}
	}

	// Presets functions
	async function loadPresets() {
		try {
			const result = await getPresets(localStorage.token || '');
			presets = result.presets || {};
		} catch (error) {
			console.error('Failed to load presets');
		}
	}

	async function handleApplyPreset(presetName: string) {
		if (!selectedRecipeForPreset) return;
		try {
			await applyPreset(localStorage.token || '', selectedRecipeForPreset, presetName);
			toast.success($i18n.t('Preset applied'));
			showPresetsModal = false;
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to apply preset'));
		}
	}

	// Benchmark functions
	async function handleRunBenchmark() {
		benchmarking = true;
		benchmarkResult = null;
		try {
			benchmarkResult = await runBenchmark(
				localStorage.token || '',
				benchmarkPrompt,
				benchmarkMaxTokens,
				benchmarkNumRequests,
				benchmarkConcurrent
			);
			toast.success($i18n.t('Benchmark complete'));
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Benchmark failed'));
		} finally {
			benchmarking = false;
		}
	}

	// Import/Export functions
	async function handleExportAll() {
		try {
			const result = await exportAllRecipes(localStorage.token || '', 'json');
			const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'vllm-studio-recipes.json';
			a.click();
			URL.revokeObjectURL(url);
			toast.success($i18n.t('Recipes exported'));
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to export recipes'));
		}
	}

	async function handleImportRecipes() {
		try {
			const data = JSON.parse(importData);
			await importRecipe(localStorage.token || '', data, 'json');
			toast.success($i18n.t('Recipes imported'));
			showImportModal = false;
			importData = '';
			await loadData();
		} catch (error: any) {
			toast.error(error.detail || $i18n.t('Failed to import recipes'));
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
		loadModels();
		loadPresets();
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
<div class="space-y-6 px-3 sm:px-5 pb-14 max-w-screen-xl mx-auto w-full overflow-x-hidden">
	<!-- Hero -->
	<div class="rounded-3xl border border-gray-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-6 shadow-xl">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div class="space-y-1">
				<div class="text-2xl font-semibold tracking-tight">vLLM Studio</div>
				<div class="text-sm text-slate-200/80">Switch models, inspect metrics, and manage recipes from one screen.</div>
			</div>
			<div class="flex flex-wrap gap-2 justify-end">
				<button class="pill-ghost" on:click={loadData} disabled={switching}>
					<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
					<span>Refresh</span>
				</button>
				<button class="pill-ghost" on:click={handleExportAll}>
					<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/></svg>
					<span>Export</span>
				</button>
				<button class="pill-ghost" on:click={() => (showImportModal = true)}>
					<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2m-4-6l-4 4m0 0l-4-4m4 4V4"/></svg>
					<span>Import</span>
				</button>
				<button class="pill-solid" on:click={openNewRecipeModal}>
					<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
					<span>New Recipe</span>
				</button>
			</div>
		</div>

		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4 text-xs">
			<div class="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-100 backdrop-blur">
				{status?.running_process ? `Running: ${getModelName(status.running_process.model_path)}` : 'No model running'}
			</div>
			<div class={`px-3 py-1.5 rounded-full border backdrop-blur ${health?.backend_reachable ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100' : 'bg-rose-500/20 border-rose-400/30 text-rose-100'}`}>
				Backend :{status?.vllm_port || 8000}
			</div>
			<div class={`px-3 py-1.5 rounded-full border backdrop-blur ${health?.proxy_reachable ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-100' : 'bg-amber-500/25 border-amber-400/40 text-amber-100'}`}>
				Proxy :{status?.proxy_port || 8001}
			</div>
			<div class="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-100 backdrop-blur">
				Recipes {recipes.length}
			</div>
			<div class="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-slate-100 backdrop-blur">
				Models {availableModels.length}
			</div>
		</div>

		<div class="flex gap-2 overflow-x-auto pt-3">
			{#each ['overview','recipes','logs','models','tools'] as tab}
				<button
					class={`px-3 py-2 text-sm font-medium whitespace-nowrap rounded-full border transition ${
						activeTab === tab
							? 'bg-white text-slate-900 border-white shadow-sm'
							: 'border-white/20 text-slate-100 hover:bg-white/10'
					}`}
					on:click={() => {
						activeTab = tab as any;
						document.getElementById(`section-${tab}`)?.scrollIntoView({ behavior: 'smooth' });
					}}
				>
					{tab.charAt(0).toUpperCase() + tab.slice(1)}
				</button>
			{/each}
		</div>
	</div>

<section id="section-overview" class="space-y-4">
	<!-- Compact GPU Status Bar -->
	{#if gpus.length > 0}
		<div class="mb-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-3">
			<button
				class="w-full flex items-center justify-between text-left"
				on:click={() => (showGpuSection = !showGpuSection)}
			>
				<div class="flex items-center gap-3">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">GPUs</span>
					<div class="flex gap-1">
						{#each gpus as gpu}
							<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs {getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 90 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}">
								<span>{gpu.id}</span>
								<span>{getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb)}%</span>
								<span>{gpu.temp_c ?? 0}°</span>
							</div>
						{/each}
					</div>
				</div>
				<svg class="size-4 text-gray-400 transition-transform {showGpuSection ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{#if showGpuSection}
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
					{#each gpus as gpu}
						<div class="text-center">
							<div class="text-xs text-gray-500 mb-1">GPU {gpu.id}</div>
							<div class="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg relative overflow-hidden">
								<div
									class="absolute bottom-0 w-full transition-all {getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 90 ? 'bg-red-500' : getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb) > 70 ? 'bg-yellow-500' : 'bg-green-500'}"
									style="height: {getMemoryPercent(gpu.memory_used_mb, gpu.memory_total_mb)}%"
								></div>
								<div class="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
									{formatMemory(gpu.memory_used_mb)}
								</div>
							</div>
							<div class="text-xs text-gray-400 mt-1">{gpu.temp_c ?? 0}°C | {gpu.power_w?.toFixed(0) ?? 0}W</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Main Dashboard Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
		<!-- Current Model - Larger -->
		<div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="flex items-center justify-between mb-3">
				<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Current Model</div>
				{#if status?.running_process}
					<button
						on:click={handleEvict}
						disabled={switching}
						class="px-2.5 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50"
					>
						{switching ? '...' : 'Stop'}
					</button>
				{/if}
			</div>
			{#if status?.running_process}
				<div class="flex items-start gap-4">
					<div class="w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse"></div>
					<div class="min-w-0 flex-1">
						<div class="text-xl font-semibold text-gray-900 dark:text-white truncate">
							{getModelName(status.running_process.model_path)}
						</div>
						<div class="flex flex-wrap gap-2 mt-2">
							<span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
								PID: {status.running_process.pid}
							</span>
							<span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
								Port: {status.running_process.port}
							</span>
							<span class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-400">
								{status.running_process.backend}
							</span>
							<span class="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-400">
								{status.running_process.memory_gb?.toFixed(1)} GB RAM
							</span>
						</div>
						{#if status.matched_recipe}
							<div class="mt-3 text-xs text-gray-500">
								Recipe: <span class="font-medium text-gray-700 dark:text-gray-300">{status.matched_recipe.name}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Quick Metrics Inline -->
				{#if metrics}
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
						<div class="text-center">
							<div class="text-lg font-semibold text-gray-900 dark:text-white">{formatThroughput(metrics.generation_throughput)}</div>
							<div class="text-xs text-gray-500">Generation</div>
						</div>
						<div class="text-center">
							<div class="text-lg font-semibold text-gray-900 dark:text-white">{metrics.running_requests ?? 0}/{metrics.pending_requests ?? 0}</div>
							<div class="text-xs text-gray-500">Running/Queue</div>
						</div>
						<div class="text-center">
							<div class="text-lg font-semibold text-gray-900 dark:text-white">{metrics.kv_cache_usage?.toFixed(0) ?? 0}%</div>
							<div class="text-xs text-gray-500">KV Cache</div>
						</div>
						<div class="text-center">
							<div class="text-lg font-semibold text-gray-900 dark:text-white">{metrics.avg_ttft_ms?.toFixed(0) ?? '-'}ms</div>
							<div class="text-xs text-gray-500">TTFT</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
						<svg class="size-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					</div>
					<div class="text-gray-500 mb-2">No model running</div>
					<button
						on:click={() => (activeTab = 'recipes')}
						class="text-sm text-blue-500 hover:text-blue-600"
					>
						Launch a recipe →
					</button>
				</div>
			{/if}
		</div>

		<!-- System Status - Compact -->
		<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">System</div>
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full {health?.backend_reachable ? 'bg-green-500' : 'bg-red-500'}"></div>
						<span class="text-sm text-gray-700 dark:text-gray-300">Backend</span>
					</div>
					<span class="text-xs text-gray-500">:{status?.vllm_port || 8000}</span>
				</div>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full {health?.proxy_reachable ? 'bg-green-500' : 'bg-yellow-500'}"></div>
						<span class="text-sm text-gray-700 dark:text-gray-300">Proxy</span>
					</div>
					<span class="text-xs text-gray-500">:{status?.proxy_port || 8001}</span>
				</div>
				<div class="pt-2 border-t border-gray-100 dark:border-gray-800">
					<div class="text-xs text-gray-500">Version {health?.version || '?'}</div>
					<div class="text-xs text-gray-500 mt-1">{recipes.length} recipes • {availableModels.length} models</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
				<button
					on:click={() => (activeTab = 'recipes')}
					class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-left"
				>
					View Recipes →
				</button>
				<button
					on:click={() => (activeTab = 'logs')}
					class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition text-left"
				>
					View Logs →
				</button>
			</div>
		</div>
	</div>

	<!-- Quick Launch - Top 5 Recipes -->
	{#if recipes.length > 0}
		<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="flex items-center justify-between mb-3">
				<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Quick Launch</div>
				<button
					on:click={() => (activeTab = 'recipes')}
					class="text-xs text-blue-500 hover:text-blue-600"
				>
					See all →
				</button>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each recipes.slice(0, 6) as recipe}
					<button
						on:click={() => recipe.status === 'running' ? null : (status?.running_process ? handleSwitch(recipe.id) : handleLaunch(recipe.id))}
						disabled={switching || recipe.status === 'running'}
						class="flex items-center justify-between p-3 rounded-xl transition text-left {recipe.status === 'running' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'} disabled:opacity-70"
					>
						<div class="min-w-0 flex-1">
							<div class="font-medium text-sm text-gray-900 dark:text-white truncate">{recipe.name}</div>
							<div class="text-xs text-gray-500 truncate">{recipe.backend} • TP{recipe.tp}</div>
						</div>
						{#if recipe.status === 'running'}
							<span class="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
						{:else}
							<svg class="ml-2 size-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

</section>

<section id="section-recipes" class="space-y-4">
	<!-- Recipes -->
	<!-- Search & Filter -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
		<div class="flex-1">
				<input
					type="text"
					bind:value={recipeSearchQuery}
					placeholder="Search recipes..."
					class="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white text-sm"
				/>
			</div>
			<button
				on:click={openNewRecipeModal}
				class="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-medium text-sm hover:opacity-80 transition flex items-center gap-1"
			>
				<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New
			</button>
		</div>

		<!-- Recipes Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			{#each filteredRecipes as recipe}
				<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4 {recipe.status === 'running' ? 'ring-2 ring-green-500' : ''}">
					<div class="flex items-start justify-between mb-2">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900 dark:text-white truncate">{recipe.name}</span>
								{#if recipe.status === 'running'}
									<span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full shrink-0">Running</span>
								{/if}
							</div>
							<div class="text-xs text-gray-500 mt-1">{recipe.id}</div>
						</div>
						<div class="flex items-center gap-1 shrink-0 ml-2">
							<button
								on:click={() => { activeTab = 'logs'; handleViewLogs(recipe.id); }}
								class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
								title="View Logs"
							>
								<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</button>
							<button
								on:click={() => openEditRecipeModal(recipe)}
								class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
								title="Edit"
							>
								<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
								</svg>
							</button>
						</div>
					</div>

					<div class="text-sm text-gray-600 dark:text-gray-400 truncate mb-3" title={recipe.model_path}>
						{getModelName(recipe.model_path)}
					</div>

					<div class="flex flex-wrap gap-1.5 mb-3">
						<span class="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">{recipe.backend}</span>
						<span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">TP{recipe.tp}</span>
						{#if recipe.pp > 1}<span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">PP{recipe.pp}</span>{/if}
						<span class="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">{recipe.kv_cache_dtype}</span>
						<span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">{(recipe.max_model_len / 1024).toFixed(0)}k ctx</span>
					</div>

					{#if recipe.status === 'running'}
						<button
							on:click={handleEvict}
							disabled={switching}
							class="w-full px-3 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm font-medium rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50"
						>
							{switching ? 'Stopping...' : 'Stop Model'}
						</button>
					{:else}
						<button
							on:click={() => status?.running_process ? handleSwitch(recipe.id) : handleLaunch(recipe.id)}
							disabled={switching}
							class="w-full px-3 py-2 bg-black text-white dark:bg-white dark:text-black text-sm font-medium rounded-xl hover:opacity-80 transition disabled:opacity-50"
						>
							{switching ? 'Working...' : status?.running_process ? 'Switch to this' : 'Launch'}
						</button>
					{/if}
				</div>
			{/each}
		</div>

		{#if filteredRecipes.length === 0}
			<div class="text-center py-12 text-gray-500">
				{recipeSearchQuery ? 'No recipes match your search' : 'No recipes found'}
			</div>
		{/if}
	</div>

</section>

<section id="section-logs" class="space-y-4">
	<div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
		<!-- Log Files Sidebar -->
		<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 h-fit">
			<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-850">
				<div class="text-sm font-medium text-gray-900 dark:text-white">Log Files</div>
			</div>
			<div class="max-h-96 overflow-y-auto">
				{#if logFiles.length > 0}
					{#each logFiles as log}
						<button
							on:click={() => handleViewLogs(log.recipe_id)}
							class="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-850/50 transition border-b border-gray-100 dark:border-gray-850 last:border-0 {selectedLogRecipe === log.recipe_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}"
						>
							<div class="font-medium text-sm text-gray-900 dark:text-white truncate">{log.recipe_id}</div>
							<div class="text-xs text-gray-500">{(log.size / 1024).toFixed(1)} KB</div>
						</button>
					{/each}
				{:else}
					<div class="p-4 text-center text-gray-500 text-sm">No log files</div>
				{/if}
			</div>
		</div>

		<!-- Log Content -->
		<div class="lg:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30">
			<div class="px-4 py-3 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-900 dark:text-white">
					{selectedLogRecipe ? selectedLogRecipe : 'Select a log file'}
				</div>
				{#if selectedLogRecipe}
					<button
						on:click={() => handleViewLogs(selectedLogRecipe)}
						class="text-xs text-blue-500 hover:text-blue-600"
					>
						Refresh
					</button>
				{/if}
			</div>
			<div class="p-3 bg-gray-950 rounded-b-2xl h-96 overflow-y-auto font-mono text-xs break-words whitespace-pre-wrap">
				{#if currentLogs.length > 0}
					{#each currentLogs as line}
						<div class="py-0.5 {line.includes('ERROR') ? 'text-red-400' : line.includes('WARNING') ? 'text-yellow-400' : line.includes('INFO') ? 'text-blue-400' : 'text-gray-400'}">
							{line}
						</div>
					{/each}
				{:else}
					<div class="text-gray-600 text-center py-8">
						{selectedLogRecipe ? 'No log content' : 'Select a log file to view'}
					</div>
				{/if}
			</div>
		</div>
	</div>

</section>

<section id="section-models" class="space-y-4">
	<div class="mb-4">
		<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
			<div class="text-sm font-medium text-gray-500 dark:text-gray-400">
				Browse available models in /mnt/llm_models
			</div>
			<button
				class="flex text-xs items-center space-x-1 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-850 dark:hover:bg-gray-800 dark:text-gray-200 transition"
				on:click={loadModels}
				disabled={modelsLoading}
			>
				<div class="self-center font-medium">{modelsLoading ? 'Loading...' : 'Refresh Models'}</div>
			</button>
		</div>

		<!-- Search -->
		<div class="mb-4">
			<input
				type="text"
				bind:value={modelSearchQuery}
				placeholder="Search models by name or architecture..."
				class="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white"
			/>
		</div>

		<!-- Models Grid -->
		{#if modelsLoading}
			<div class="flex justify-center py-8">
				<Spinner className="size-6" />
			</div>
		{:else if filteredModels.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each filteredModels as model}
					<div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100/30 dark:border-gray-850/30 p-4">
						<div class="flex items-start justify-between mb-2">
							<div class="font-medium text-gray-900 dark:text-white truncate flex-1" title={model.name}>
								{model.name}
							</div>
							{#if model.has_recipe}
								<span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full ml-2 shrink-0">
									Recipe
								</span>
							{/if}
						</div>
						<div class="space-y-1 text-xs text-gray-500 mb-3">
							{#if model.architecture}
								<div>Arch: {model.architecture}</div>
							{/if}
							{#if model.quantization}
								<div>Quant: <span class="px-1 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">{model.quantization}</span></div>
							{/if}
							{#if model.context_length}
								<div>Context: {(model.context_length / 1024).toFixed(0)}k</div>
							{/if}
							{#if model.size_gb && model.size_gb > 0}
								<div>Size: {model.size_gb.toFixed(1)} GB</div>
							{/if}
							{#if model.num_experts}
								<div>Experts: {model.num_experts}</div>
							{/if}
						</div>
						<div class="flex gap-2">
							<button
								on:click={() => openGenerateFromModel(model)}
								class="flex-1 px-2 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
							>
								Generate Recipe
							</button>
							<button
								on:click={() => { toolsModelPath = model.path; activeTab = 'tools'; }}
								class="px-2 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
							>
								Analyze
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-8 text-gray-500">
				{modelSearchQuery ? 'No models match your search' : 'No models found'}
			</div>
		{/if}
	</div>
</section>

<section id="section-tools" class="space-y-4">
	<!-- Tools - VRAM Estimator -->
	<div class="space-y-4">
		<!-- Model Selection & Configuration -->
		<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
			<div class="text-sm font-medium text-gray-900 dark:text-white mb-4">VRAM Estimator</div>
			<div class="space-y-4">
				<div>
					<label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">Model Path</label>
					<input
						type="text"
						bind:value={toolsModelPath}
						placeholder="/mnt/llm_models/..."
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
					/>
				</div>

				<!-- Interactive Sliders -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Context Length Slider -->
					<div>
						<div class="flex items-center justify-between mb-2">
							<label class="text-sm text-gray-600 dark:text-gray-400">Context Length</label>
							<span class="text-sm font-medium text-gray-900 dark:text-white">{(toolsContextLen / 1024).toFixed(0)}k tokens</span>
						</div>
						<input
							type="range"
							bind:value={toolsContextLen}
							min="4096"
							max="262144"
							step="4096"
							on:change={recalculateVRAM}
							class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
						/>
						<div class="flex justify-between text-xs text-gray-400 mt-1">
							<span>4k</span>
							<span>32k</span>
							<span>64k</span>
							<span>128k</span>
							<span>256k</span>
						</div>
					</div>

					<!-- GPU Count Slider -->
					<div>
						<div class="flex items-center justify-between mb-2">
							<label class="text-sm text-gray-600 dark:text-gray-400">GPUs (Tensor Parallel)</label>
							<span class="text-sm font-medium text-gray-900 dark:text-white">{toolsTpSize} GPU{toolsTpSize > 1 ? 's' : ''}</span>
						</div>
						<input
							type="range"
							bind:value={toolsTpSize}
							min="1"
							max="8"
							step="1"
							on:change={recalculateVRAM}
							class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
						/>
						<div class="flex justify-between text-xs text-gray-400 mt-1">
							<span>1</span>
							<span>2</span>
							<span>4</span>
							<span>6</span>
							<span>8</span>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
					<!-- Batch Size -->
					<div>
						<label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Batch Size (max_num_seqs)</label>
						<input
							type="number"
							bind:value={toolsBatchSize}
							min="1"
							max="256"
							on:change={recalculateVRAM}
							class="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm"
						/>
					</div>

					<!-- KV Cache Dtype Toggle -->
					<div>
						<label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">KV Cache Precision</label>
						<div class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
							<button
								on:click={() => { toolsKvCacheDtype = 'fp16'; recalculateVRAM(); }}
								class="flex-1 px-3 py-1.5 text-xs font-medium transition {toolsKvCacheDtype === 'fp16' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
							>
								FP16
							</button>
							<button
								on:click={() => { toolsKvCacheDtype = 'fp8'; recalculateVRAM(); }}
								class="flex-1 px-3 py-1.5 text-xs font-medium transition {toolsKvCacheDtype === 'fp8' ? 'bg-green-600 text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}"
							>
								FP8 (50% less)
							</button>
						</div>
					</div>

					<!-- Analyze Button -->
					<div class="flex items-end">
						<button
							on:click={analyzeModel}
							disabled={!toolsModelPath || toolsLoading}
							class="w-full px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium text-sm hover:opacity-80 transition disabled:opacity-50"
						>
							{toolsLoading ? 'Analyzing...' : 'Analyze'}
						</button>
					</div>
				</div>
			</div>
		</div>

		{#if vramCalc}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<!-- VRAM Breakdown -->
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="flex items-center justify-between mb-4">
						<div class="text-sm font-medium text-gray-900 dark:text-white">VRAM Breakdown</div>
						<span class="px-2 py-0.5 text-xs font-medium rounded-full {vramCalc.fits ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}">
							{vramCalc.fits ? 'Fits in VRAM' : 'Exceeds VRAM'}
						</span>
					</div>

					<!-- Visual VRAM Bar -->
					<div class="mb-4">
						<div class="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex">
							{#if vramCalc.breakdown}
								{@const weightsPercent = ((vramCalc.breakdown?.model_weights_gb || 0) / (vramCalc.breakdown?.total_gb || 1)) * Math.min(vramCalc.utilization_percent, 100)}
								{@const kvPercent = ((vramCalc.breakdown?.kv_cache_gb || 0) / (vramCalc.breakdown?.total_gb || 1)) * Math.min(vramCalc.utilization_percent, 100)}
								{@const actPercent = ((vramCalc.breakdown?.activations_gb || 0) / (vramCalc.breakdown?.total_gb || 1)) * Math.min(vramCalc.utilization_percent, 100)}
								<div class="bg-blue-500 h-full" style="width: {weightsPercent}%" title="Model Weights"></div>
								<div class="bg-purple-500 h-full" style="width: {kvPercent}%" title="KV Cache"></div>
								<div class="bg-orange-500 h-full" style="width: {actPercent}%" title="Activations"></div>
							{/if}
						</div>
						<div class="flex items-center justify-center gap-4 mt-2 text-xs">
							<div class="flex items-center gap-1"><div class="w-3 h-3 bg-blue-500 rounded"></div> Weights</div>
							<div class="flex items-center gap-1"><div class="w-3 h-3 bg-purple-500 rounded"></div> KV Cache</div>
							<div class="flex items-center gap-1"><div class="w-3 h-3 bg-orange-500 rounded"></div> Activations</div>
						</div>
					</div>

					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-500">Model Weights</span>
							<span class="text-gray-900 dark:text-white font-medium">{vramCalc.breakdown?.model_weights_gb?.toFixed(1)} GB</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500">KV Cache ({toolsKvCacheDtype.toUpperCase()})</span>
							<span class="text-gray-900 dark:text-white font-medium">{vramCalc.breakdown?.kv_cache_gb?.toFixed(1)} GB</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500">Activations</span>
							<span class="text-gray-900 dark:text-white font-medium">{vramCalc.breakdown?.activations_gb?.toFixed(1)} GB</span>
						</div>
						<div class="flex justify-between font-medium border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
							<span class="text-gray-700 dark:text-gray-300">Total Required</span>
							<span class="text-gray-900 dark:text-white">{vramCalc.breakdown?.total_gb?.toFixed(1)} GB</span>
						</div>
						<div class="flex justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
							<span class="text-gray-500">Per GPU ({vramCalc.tp_size} x RTX 3090)</span>
							<span class="{(vramCalc.breakdown?.per_gpu_gb || 0) > (vramCalc.gpu_info?.memory_per_gpu_gb || 24) ? 'text-red-500 font-bold' : 'text-green-600 dark:text-green-400 font-medium'}">
								{vramCalc.breakdown?.per_gpu_gb?.toFixed(1)} GB / {vramCalc.gpu_info?.memory_per_gpu_gb || 24} GB
							</span>
						</div>
					</div>

					<!-- Utilization Gauge -->
					<div class="mt-4">
						<div class="flex items-center justify-between text-xs text-gray-500 mb-1">
							<span>GPU Utilization</span>
							<span class="{vramCalc.utilization_percent > 95 ? 'text-red-500' : vramCalc.utilization_percent > 85 ? 'text-yellow-500' : 'text-green-500'} font-medium">
								{vramCalc.utilization_percent?.toFixed(1)}%
							</span>
						</div>
						<div class="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all {vramCalc.utilization_percent > 95 ? 'bg-red-500' : vramCalc.utilization_percent > 85 ? 'bg-yellow-500' : 'bg-green-500'}"
								style="width: {Math.min(vramCalc.utilization_percent, 100)}%"
							></div>
						</div>
					</div>

					{#if vramCalc.recommendations && vramCalc.recommendations.length > 0}
						<div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
							<div class="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Recommendations</div>
							<ul class="text-xs text-blue-600 dark:text-blue-300 space-y-1">
								{#each vramCalc.recommendations as rec}
									<li>• {rec}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<!-- Context Length Comparison Table (LMStudio-style) -->
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="text-sm font-medium text-gray-900 dark:text-white mb-4">Context Length Options</div>

					{#if vramCalc.context_configs && vramCalc.context_configs.length > 0}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
										<th class="text-left py-2 font-medium">Context</th>
										<th class="text-right py-2 font-medium">KV Cache</th>
										<th class="text-right py-2 font-medium">Total</th>
										<th class="text-right py-2 font-medium">Per GPU</th>
										<th class="text-center py-2 font-medium">Status</th>
									</tr>
								</thead>
								<tbody>
									{#each vramCalc.context_configs as config}
										<tr class="border-b border-gray-100 dark:border-gray-800 {config.context_length === toolsContextLen ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
											on:click={() => { toolsContextLen = config.context_length; recalculateVRAM(); }}
										>
											<td class="py-2 font-medium text-gray-900 dark:text-white">
												{(config.context_length / 1024).toFixed(0)}k
												{#if config.context_length === toolsContextLen}
													<span class="ml-1 text-xs text-blue-500">selected</span>
												{/if}
											</td>
											<td class="py-2 text-right text-gray-600 dark:text-gray-400">{config.kv_cache_gb.toFixed(1)} GB</td>
											<td class="py-2 text-right text-gray-600 dark:text-gray-400">{config.total_gb.toFixed(1)} GB</td>
											<td class="py-2 text-right {config.per_gpu_gb > (vramCalc.gpu_info?.memory_per_gpu_gb || 24) ? 'text-red-500 font-medium' : 'text-gray-600 dark:text-gray-400'}">{config.per_gpu_gb.toFixed(1)} GB</td>
											<td class="py-2 text-center">
												{#if config.fits}
													<span class="inline-flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full">
														<svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
														</svg>
													</span>
												{:else}
													<span class="inline-flex items-center justify-center w-5 h-5 bg-red-100 dark:bg-red-900/30 rounded-full">
														<svg class="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
														</svg>
													</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="text-center py-4 text-gray-500 text-sm">
							Context configurations will appear after analysis
						</div>
					{/if}

					<!-- Model Info -->
					{#if vramCalc.model_info}
						<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
							<div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Model Architecture</div>
							<div class="grid grid-cols-2 gap-2 text-xs text-gray-500">
								<div>Layers: {vramCalc.model_info.num_layers}</div>
								<div>Hidden: {vramCalc.model_info.hidden_size}</div>
								<div>KV Heads: {vramCalc.model_info.num_kv_heads}</div>
								<div>Head Dim: {vramCalc.model_info.head_dim}</div>
								{#if vramCalc.model_info.num_experts && vramCalc.model_info.num_experts > 1}
									<div>Experts: {vramCalc.model_info.num_experts}</div>
								{/if}
								<div>Max Context: {(vramCalc.model_info.max_context / 1024).toFixed(0)}k</div>
							</div>
							<div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
								KV bytes/token ({toolsKvCacheDtype.toUpperCase()}): {vramCalc.model_info.kv_bytes_per_token?.toLocaleString()} bytes
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- FP8 Advice & Compatibility Row -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<!-- FP8 Advice -->
			{#if fp8Advice}
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="font-medium text-sm mb-3 {fp8Advice.fp8_kv_recommended ? 'text-green-600' : 'text-yellow-600'}">
						FP8 KV Cache: {fp8Advice.fp8_kv_recommended ? 'Recommended' : 'Not Recommended'}
					</div>
					{#if fp8Advice.reasons && fp8Advice.reasons.length > 0}
						<ul class="text-xs text-gray-500 space-y-1">
							{#each fp8Advice.reasons as reason}
								<li>• {reason}</li>
							{/each}
						</ul>
					{/if}
					{#if fp8Advice.expected_memory_savings}
						<div class="text-xs text-gray-500 mt-2">
							Expected savings: ~{fp8Advice.expected_memory_savings}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Compatibility -->
			{#if compatCheck}
				<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
					<div class="font-medium text-sm mb-3 text-gray-900 dark:text-white">Backend Compatibility</div>
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<div class="w-3 h-3 rounded-full {compatCheck.vllm_compatible ? 'bg-green-500' : 'bg-red-500'}"></div>
							<span class="text-gray-700 dark:text-gray-300">vLLM</span>
						</div>
						<div class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<div class="w-3 h-3 rounded-full {compatCheck.sglang_compatible ? 'bg-green-500' : 'bg-red-500'}"></div>
							<span class="text-gray-700 dark:text-gray-300">SGLang</span>
						</div>
					</div>
					{#if compatCheck.recommended_backend}
						<div class="text-xs text-gray-500 mt-3">
							Recommended: <span class="font-medium text-blue-600">{compatCheck.recommended_backend}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Presets -->
			<div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100/30 dark:border-gray-850/30 p-4">
				<div class="text-sm font-medium text-gray-900 dark:text-white mb-3">Quick Presets</div>
				<div class="space-y-2">
					{#each Object.entries(presets).slice(0, 3) as [key, preset]}
						<div class="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
							<div class="font-medium text-xs text-gray-900 dark:text-white">{preset.name}</div>
							<div class="text-xs text-gray-500 truncate">{preset.description}</div>
						</div>
					{/each}
					{#if Object.keys(presets).length === 0}
						<div class="text-center py-2 text-gray-500 text-xs">
							No presets available
						</div>
					{/if}
				</div>
			</div>
		</div>
</div>
{/if}
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
</section>

<!-- Generate Recipe Modal -->
{#if showGenerateModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" on:click|self={() => (showGenerateModal = false)}>
		<div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
			<div class="p-4 border-b border-gray-200 dark:border-gray-800">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">Generate Recipe</h3>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Path</label>
					<input
						type="text"
						bind:value={generateModelPath}
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						placeholder="/mnt/llm_models/..."
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipe Name (optional)</label>
					<input
						type="text"
						bind:value={generateName}
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
						placeholder="Auto-generated from model name"
					/>
				</div>
				<button
					on:click={handleGenerateRecipe}
					disabled={generating || !generateModelPath}
					class="w-full px-3 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-medium text-sm hover:opacity-80 transition disabled:opacity-50"
				>
					{generating ? 'Generating...' : 'Generate Recipe'}
				</button>

				{#if generatedRecipe}
					<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
						<div class="font-medium text-sm mb-2 text-gray-900 dark:text-white">Generated Recipe</div>
						<div class="space-y-1 text-xs text-gray-500">
							<div>ID: {generatedRecipe.recipe?.id}</div>
							<div>Name: {generatedRecipe.recipe?.name}</div>
							<div>Backend: {generatedRecipe.recipe?.backend}</div>
							<div>TP: {generatedRecipe.recipe?.tensor_parallel_size} | Max Len: {generatedRecipe.recipe?.max_model_len}</div>
							{#if generatedRecipe.analysis}
								<div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
									<div class="font-medium">Analysis:</div>
									<div>Architecture: {generatedRecipe.analysis.architecture}</div>
									<div>Estimated Size: {generatedRecipe.analysis.estimated_size_gb?.toFixed(1)} GB</div>
									<div>Recommended TP: {generatedRecipe.analysis.recommended_tp}</div>
								</div>
							{/if}
						</div>
						<button
							on:click={handleSaveGeneratedRecipe}
							class="w-full mt-3 px-3 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition"
						>
							Save Recipe
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Benchmark Modal -->
{#if showBenchmarkModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" on:click|self={() => (showBenchmarkModal = false)}>
		<div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
			<div class="p-4 border-b border-gray-200 dark:border-gray-800">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">Inference Benchmark</h3>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt</label>
					<textarea
						bind:value={benchmarkPrompt}
						rows="3"
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm"
					></textarea>
				</div>
				<div class="grid grid-cols-3 gap-3">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens</label>
						<input type="number" bind:value={benchmarkMaxTokens} class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requests</label>
						<input type="number" bind:value={benchmarkNumRequests} class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concurrent</label>
						<input type="number" bind:value={benchmarkConcurrent} class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm" />
					</div>
				</div>
				<button
					on:click={handleRunBenchmark}
					disabled={benchmarking}
					class="w-full px-3 py-2 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition disabled:opacity-50"
				>
					{benchmarking ? 'Running Benchmark...' : 'Run Benchmark'}
				</button>

				{#if benchmarkResult}
					<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
						<div class="font-medium text-sm mb-3 text-gray-900 dark:text-white">Results</div>
						<div class="grid grid-cols-2 gap-3 text-sm">
							<div class="p-2 bg-white dark:bg-gray-900 rounded-lg">
								<div class="text-xs text-gray-500">Tokens/sec</div>
								<div class="font-medium text-gray-900 dark:text-white">{benchmarkResult.tokens_per_second?.toFixed(1)}</div>
							</div>
							<div class="p-2 bg-white dark:bg-gray-900 rounded-lg">
								<div class="text-xs text-gray-500">Avg Latency</div>
								<div class="font-medium text-gray-900 dark:text-white">{benchmarkResult.avg_latency_ms?.toFixed(0)} ms</div>
							</div>
							<div class="p-2 bg-white dark:bg-gray-900 rounded-lg">
								<div class="text-xs text-gray-500">Avg TTFT</div>
								<div class="font-medium text-gray-900 dark:text-white">{benchmarkResult.avg_ttft_ms?.toFixed(0)} ms</div>
							</div>
							<div class="p-2 bg-white dark:bg-gray-900 rounded-lg">
								<div class="text-xs text-gray-500">Total Tokens</div>
								<div class="font-medium text-gray-900 dark:text-white">{benchmarkResult.total_tokens}</div>
							</div>
						</div>
						{#if benchmarkResult.error}
							<div class="mt-2 text-xs text-red-500">{benchmarkResult.error}</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Import Modal -->
{#if showImportModal}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" on:click|self={() => (showImportModal = false)}>
		<div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
			<div class="p-4 border-b border-gray-200 dark:border-gray-800">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">Import Recipes</h3>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paste JSON</label>
					<textarea
						bind:value={importData}
						rows="10"
						class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm font-mono"
						placeholder="Paste JSON recipe data here..."
					></textarea>
				</div>
				<div class="flex gap-2">
					<button
						on:click={() => (showImportModal = false)}
						class="flex-1 px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition"
					>
						Cancel
					</button>
					<button
						on:click={handleImportRecipes}
						disabled={!importData}
						class="flex-1 px-3 py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl font-medium text-sm hover:opacity-80 transition disabled:opacity-50"
					>
						Import
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
