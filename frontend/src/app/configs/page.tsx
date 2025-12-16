'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calculator, Wand2, RefreshCw, Save, Trash2, Copy, FileText, Plus } from 'lucide-react';
import api from '@/lib/api';
import type { ModelInfo, Recipe, RecipeWithStatus, VRAMCalculation } from '@/lib/types';

// Convert a Recipe object to a vLLM/sglang command string
function recipeToCommand(recipe: Recipe): string {
  const lines: string[] = [];

  // Start with CUDA_VISIBLE_DEVICES if we have tp/pp info
  const tp = recipe.tp || recipe.tensor_parallel_size || 1;
  const pp = recipe.pp || recipe.pipeline_parallel_size || 1;
  const totalGpus = tp * pp;
  if (totalGpus > 1) {
    const gpuIds = Array.from({ length: totalGpus }, (_, i) => i).join(',');
    lines.push(`CUDA_VISIBLE_DEVICES=${gpuIds} \\`);
  }

  // Main command
  const backend = recipe.backend || 'vllm';
  if (backend === 'sglang') {
    lines.push(`python -m sglang.launch_server \\`);
    lines.push(`  --model-path ${recipe.model_path} \\`);
  } else {
    lines.push(`vllm serve ${recipe.model_path} \\`);
  }

  // Add arguments
  const args: [string, string | number | boolean | undefined][] = [
    ['--tensor-parallel-size', tp],
    ['--pipeline-parallel-size', pp > 1 ? pp : undefined],
    ['--dtype', recipe.dtype],
    ['--max-model-len', recipe.max_model_len],
    ['--block-size', (recipe.block_size ?? (recipe.extra_args?.block_size as number | undefined)) as number | undefined],
    ['--max-num-seqs', recipe.max_num_seqs],
    ['--max-num-batched-tokens', recipe.max_num_batched_tokens],
    ['--gpu-memory-utilization', recipe.gpu_memory_utilization],
    ['--swap-space', (recipe.swap_space ?? (recipe.extra_args?.swap_space as number | undefined)) as number | undefined],
    ['--kv-cache-dtype', recipe.kv_cache_dtype],
    ['--quantization', recipe.quantization],
    ['--reasoning-parser', (recipe.reasoning_parser ?? (recipe.extra_args?.reasoning_parser as string | undefined)) as string | undefined],
    ['--tool-call-parser', recipe.tool_call_parser],
    ['--served-model-name', recipe.served_model_name],
  ];

  // Boolean flags
  if (recipe.enable_auto_tool_choice) args.push(['--enable-auto-tool-choice', true]);
  if (recipe.disable_custom_all_reduce ?? recipe.extra_args?.disable_custom_all_reduce) args.push(['--disable-custom-all-reduce', true]);
  if (recipe.trust_remote_code ?? recipe.extra_args?.trust_remote_code) args.push(['--trust-remote-code', true]);
  if (recipe.disable_log_requests ?? recipe.extra_args?.disable_log_requests) args.push(['--disable-log-requests', true]);
  if (recipe.enable_expert_parallel ?? recipe.extra_args?.enable_expert_parallel) args.push(['--enable-expert-parallel', true]);

  for (const [flag, value] of args) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') {
      if (value) lines.push(`  ${flag} \\`);
    } else {
      lines.push(`  ${flag} ${value} \\`);
    }
  }

  // Host and port
  lines.push(`  --host ${recipe.host || '0.0.0.0'} \\`);
  lines.push(`  --port ${recipe.port || 8000}`);

  return lines.join('\n');
}

// Parse a vLLM/sglang command string to a Recipe object
function parseCommand(command: string, existingRecipe?: Partial<Recipe>): Recipe {
  const recipe: Recipe = {
    id: existingRecipe?.id || '',
    name: existingRecipe?.name || '',
    model_path: existingRecipe?.model_path || '',
    backend: 'vllm',
    extra_args: {},
  };

  // Normalize line continuations
  const normalizedCmd = command.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Detect backend
  if (normalizedCmd.includes('sglang')) {
    recipe.backend = 'sglang';
  }

  // Extract model path
  const modelMatch = normalizedCmd.match(/(?:vllm serve|--model-path|--model)\s+(\/[^\s]+)/);
  if (modelMatch) {
    recipe.model_path = modelMatch[1];
  }

  // Extract CUDA_VISIBLE_DEVICES
  const cudaMatch = normalizedCmd.match(/CUDA_VISIBLE_DEVICES=([\d,]+)/);
  if (cudaMatch) {
    recipe.extra_args!.cuda_visible_devices = cudaMatch[1];
  }

  // Parse all --flag value pairs
  const flagPattern = /--([\w-]+)(?:\s+([^\s-][^\s]*))?/g;
  let match;
  while ((match = flagPattern.exec(normalizedCmd)) !== null) {
    const [, flag, value] = match;

    switch (flag) {
      case 'tensor-parallel-size':
        recipe.tp = parseInt(value) || 1;
        recipe.tensor_parallel_size = recipe.tp;
        break;
      case 'pipeline-parallel-size':
        recipe.pp = parseInt(value) || 1;
        recipe.pipeline_parallel_size = recipe.pp;
        break;
      case 'max-model-len':
        recipe.max_model_len = parseInt(value) || undefined;
        break;
      case 'gpu-memory-utilization':
        recipe.gpu_memory_utilization = parseFloat(value) || 0.9;
        break;
      case 'max-num-seqs':
        recipe.max_num_seqs = parseInt(value) || undefined;
        break;
      case 'max-num-batched-tokens':
        recipe.max_num_batched_tokens = parseInt(value) || undefined;
        break;
      case 'kv-cache-dtype':
        recipe.kv_cache_dtype = value;
        break;
      case 'quantization':
        recipe.quantization = value;
        break;
      case 'dtype':
        recipe.dtype = value;
        break;
      case 'tool-call-parser':
        recipe.tool_call_parser = value;
        break;
      case 'served-model-name':
        recipe.served_model_name = value;
        break;
      case 'model':
      case 'model-path':
        if (!recipe.model_path && value) recipe.model_path = value;
        break;
      case 'port':
        recipe.port = parseInt(value) || 8000;
        break;
      case 'block-size':
        recipe.block_size = parseInt(value);
        break;
      case 'swap-space':
        recipe.swap_space = parseInt(value);
        break;
      case 'reasoning-parser':
        recipe.reasoning_parser = value;
        break;
      // Boolean flags (no value or next token starts with --)
      case 'enable-auto-tool-choice':
        recipe.enable_auto_tool_choice = true;
        break;
      case 'disable-custom-all-reduce':
        recipe.disable_custom_all_reduce = true;
        break;
      case 'trust-remote-code':
        recipe.trust_remote_code = true;
        break;
      case 'disable-log-requests':
        recipe.disable_log_requests = true;
        break;
      case 'enable-expert-parallel':
        recipe.enable_expert_parallel = true;
        break;
    }
  }

  // Generate ID from model path if not set
  if (!recipe.id && recipe.model_path) {
    recipe.id = recipe.model_path.split('/').pop()?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'new-recipe';
  }

  // Generate name if not set
  if (!recipe.name && recipe.model_path) {
    recipe.name = recipe.model_path.split('/').pop() || 'New Recipe';
  }

  return recipe;
}

function ConfigsContent() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const editRecipeId = searchParams.get("edit");

  // VRAM Calculator State
  const [vramModel, setVramModel] = useState('');
  const [contextLength, setContextLength] = useState(32768);
  const [tpSize, setTpSize] = useState(8);
  const [kvDtype, setKvDtype] = useState<'auto' | 'fp16' | 'fp8'>('auto');
  const [vramResult, setVramResult] = useState<VRAMCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Command Editor State
  const [commandText, setCommandText] = useState('');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeId, setRecipeId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [modelsData, recipesData] = await Promise.all([
        api.getModels(),
        api.getRecipes(),
      ]);
      setModels(modelsData.models || []);
      setRecipes(recipesData.recipes || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };


  // Load recipe for editing when ?edit= param is present
  useEffect(() => {
    if (editRecipeId && recipes.length > 0) {
      const recipeToEdit = recipes.find(r => r.id === editRecipeId);
      if (recipeToEdit) {
        setRecipeId(recipeToEdit.id);
        setRecipeName(recipeToEdit.name);
        setCommandText(recipeToCommand(recipeToEdit));
        setEditingRecipe(recipeToEdit);
        setParseError(null);
      }
    }
  }, [editRecipeId, recipes]);
  const calculateVRAM = async () => {
    if (!vramModel) return;
    setCalculating(true);
    try {
      const data = await api.calculateVRAM({
        model_path: vramModel,
        context_length: contextLength,
        batch_size: 1,
        tp_size: tpSize,
        kv_cache_dtype: kvDtype,
      });
      setVramResult(data);
    } catch (e) {
      alert('Failed to calculate VRAM: ' + (e as Error).message);
    } finally {
      setCalculating(false);
    }
  };

  // Handle command text changes
  const handleCommandChange = (text: string) => {
    setCommandText(text);
    setParseError(null);

    try {
      const parsed = parseCommand(text, { id: recipeId, name: recipeName });
      setEditingRecipe(parsed);
      if (!recipeId && parsed.id) setRecipeId(parsed.id);
      if (!recipeName && parsed.name) setRecipeName(parsed.name);
    } catch (e) {
      setParseError((e as Error).message);
    }
  };

  // Load existing recipe into editor
  const loadRecipeIntoEditor = (recipe: RecipeWithStatus) => {
    setRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setCommandText(recipeToCommand(recipe));
    setEditingRecipe(recipe);
    setParseError(null);
  };

  // Create new recipe
  const startNewRecipe = () => {
    setRecipeId('');
    setRecipeName('');
    setCommandText(`# Paste your vLLM command here, e.g.:
CUDA_VISIBLE_DEVICES=0,1 \\
vllm serve /mnt/llm_models/MyModel \\
  --tensor-parallel-size 2 \\
  --max-model-len 32768 \\
  --gpu-memory-utilization 0.9 \\
  --host 0.0.0.0 \\
  --port 8000`);
    setEditingRecipe(null);
    setParseError(null);
  };

  // Save recipe
  const saveRecipe = async () => {
    if (!editingRecipe || !recipeId || !recipeName) {
      alert('Please provide a recipe ID and name');
      return;
    }

    setSaving(true);
    try {
      const recipeToSave = {
        ...editingRecipe,
        id: recipeId,
        name: recipeName,
      };

      // Check if recipe exists
      const existingRecipe = recipes.find(r => r.id === recipeId);
      if (existingRecipe) {
        await api.updateRecipe(recipeId, recipeToSave);
      } else {
        await api.createRecipe(recipeToSave);
      }

      alert('Recipe saved!');
      await loadData();
      setCommandText('');
      setEditingRecipe(null);
      setRecipeId('');
      setRecipeName('');
    } catch (e) {
      alert('Failed to save: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipe = async (id: string) => {
    if (!confirm(`Delete recipe "${id}"?`)) return;
    try {
      await api.deleteRecipe(id);
      await loadData();
    } catch (e) {
      alert('Failed to delete recipe: ' + (e as Error).message);
    }
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(commandText);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <RefreshCw className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Configuration Tools</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Command-style Recipe Editor */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg lg:col-span-2">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="font-medium">Recipe Editor (Command Style)</h2>
            </div>
            <button
              onClick={startNewRecipe}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Recipe
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">Recipe ID</label>
                <input
                  type="text"
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="e.g., qwen3-vl-32b"
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">Recipe Name</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g., Qwen3-VL 32B Thinking"
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-[var(--muted-foreground)]">
                  vLLM/SGLang Command (paste or edit)
                </label>
                <button
                  onClick={copyCommand}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <textarea
                value={commandText}
                onChange={(e) => handleCommandChange(e.target.value)}
                placeholder="Paste your vLLM serve command here..."
                rows={12}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)] resize-y"
                style={{ tabSize: 2 }}
              />
              {parseError && (
                <p className="text-xs text-[var(--error)] mt-1">{parseError}</p>
              )}
            </div>

            {editingRecipe && (
              <div className="p-3 bg-[var(--background)] rounded-lg">
                <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Parsed Configuration:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Backend:</span>{' '}
                    <span className="font-mono">{editingRecipe.backend}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">TP:</span>{' '}
                    <span className="font-mono">{editingRecipe.tp || editingRecipe.tensor_parallel_size || 1}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">PP:</span>{' '}
                    <span className="font-mono">{editingRecipe.pp || editingRecipe.pipeline_parallel_size || 1}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Context:</span>{' '}
                    <span className="font-mono">{editingRecipe.max_model_len?.toLocaleString() || 'default'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">GPU Mem:</span>{' '}
                    <span className="font-mono">{((editingRecipe.gpu_memory_utilization || 0.9) * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">KV Cache:</span>{' '}
                    <span className="font-mono">{editingRecipe.kv_cache_dtype || 'auto'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--muted-foreground)]">Model:</span>{' '}
                    <span className="font-mono truncate">{editingRecipe.model_path?.split('/').pop()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={saveRecipe}
                disabled={!editingRecipe || !recipeId || !recipeName || saving}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Recipe'}
              </button>
              <button
                onClick={() => {
                  setCommandText('');
                  setEditingRecipe(null);
                  setRecipeId('');
                  setRecipeName('');
                }}
                className="px-6 py-2 bg-[var(--card-hover)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* VRAM Calculator */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
          <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <Calculator className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="font-medium">VRAM Calculator</h2>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Model</label>
              <select
                value={vramModel}
                onChange={(e) => setVramModel(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select a model...</option>
                {models.map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  Context Length
                </label>
                <input
                  type="number"
                  value={contextLength}
                  onChange={(e) => setContextLength(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  TP Size
                </label>
                <select
                  value={tpSize}
                  onChange={(e) => setTpSize(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  {[1, 2, 4, 8].map((n) => (
                    <option key={n} value={n}>{n} GPU{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={calculateVRAM}
              disabled={!vramModel || calculating}
              className="w-full py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {calculating ? 'Calculating...' : 'Calculate VRAM'}
            </button>

            {vramResult && (
              <div className="mt-4 p-4 bg-[var(--background)] rounded-lg">
                <h3 className="font-medium mb-3">VRAM Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Model Weights</span>
                    <span className="font-mono">{vramResult.breakdown.model_weights_gb.toFixed(2)} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">KV Cache</span>
                    <span className="font-mono">{vramResult.breakdown.kv_cache_gb.toFixed(2)} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Activations</span>
                    <span className="font-mono">{vramResult.breakdown.activations_gb.toFixed(2)} GB</span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total per GPU</span>
                      <span className="font-mono">{vramResult.breakdown.per_gpu_gb.toFixed(2)} GB</span>
                    </div>
                  </div>
                  <div className={`mt-2 p-2 rounded ${
                    vramResult.fits
                      ? 'bg-[var(--success)]/10 text-[var(--success)]'
                      : 'bg-[var(--error)]/10 text-[var(--error)]'
                  }`}>
                    {vramResult.fits ? 'Will fit in GPU memory' : 'May exceed available VRAM'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Generate from Model */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
          <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <Wand2 className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="font-medium">Quick Generate</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Select a model to generate a starter command template.
            </p>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const model = models.find(m => m.path === e.target.value);
                  if (model) {
                    const template = `CUDA_VISIBLE_DEVICES=0,1,2,3 \\
vllm serve ${model.path} \\
  --tensor-parallel-size 4 \\
  --max-model-len 32768 \\
  --gpu-memory-utilization 0.9 \\
  --trust-remote-code \\
  --host 0.0.0.0 \\
  --port 8000`;
                    setCommandText(template);
                    handleCommandChange(template);
                  }
                }
              }}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Existing Recipes */}
      <div className="mt-6 bg-[var(--card)] border border-[var(--border)] rounded-lg">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-medium">Existing Recipes ({recipes.length})</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {recipes.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)]">
              No recipes yet. Create one above!
            </div>
          ) : (
            recipes.map((recipe) => (
              <div key={recipe.id} className="p-4 flex items-center justify-between hover:bg-[var(--card-hover)] transition-colors">
                <button
                  onClick={() => loadRecipeIntoEditor(recipe)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{recipe.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      recipe.backend === 'vllm'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {recipe.backend}
                    </span>
                    {recipe.status === 'running' && (
                      <span className="px-2 py-0.5 bg-[var(--success)]/10 text-[var(--success)] rounded text-xs">
                        Running
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1 truncate">
                    {recipe.model_path}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                    TP: {recipe.tp || recipe.tensor_parallel_size || 1} |
                    PP: {recipe.pp || recipe.pipeline_parallel_size || 1} |
                    Context: {recipe.max_model_len?.toLocaleString()} |
                    Mem: {((recipe.gpu_memory_utilization || 0.9) * 100).toFixed(0)}%
                  </div>
                </button>
                <button
                  onClick={() => deleteRecipe(recipe.id)}
                  disabled={recipe.status === 'running'}
                  className="p-2 text-[var(--muted-foreground)] hover:text-[var(--error)] disabled:opacity-50 transition-colors ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function ConfigsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-4rem)]"><RefreshCw className="h-8 w-8 animate-spin text-[var(--muted)]" /></div>}>
      <ConfigsContent />
    </Suspense>
  );
}
