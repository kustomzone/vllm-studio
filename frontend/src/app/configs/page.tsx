'use client';

import { useState, useEffect } from 'react';
import { Calculator, Wand2, RefreshCw, Check, ChevronDown, Save, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { ModelInfo, Recipe, RecipeWithStatus, VRAMCalculation } from '@/lib/types';

export default function ConfigsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // VRAM Calculator State
  const [vramModel, setVramModel] = useState('');
  const [contextLength, setContextLength] = useState(32768);
  const [batchSize, setBatchSize] = useState(1);
  const [tpSize, setTpSize] = useState(8);
  const [kvDtype, setKvDtype] = useState<'auto' | 'fp16' | 'fp8'>('auto');
  const [vramResult, setVramResult] = useState<VRAMCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Recipe Generator State
  const [recipeModel, setRecipeModel] = useState('');
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

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

  const calculateVRAM = async () => {
    if (!vramModel) return;
    setCalculating(true);
    try {
      const data = await api.calculateVRAM({
        model_path: vramModel,
        context_length: contextLength,
        batch_size: batchSize,
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

  const generateRecipe = async () => {
    if (!recipeModel) return;
    setGenerating(true);
    try {
      const data = await api.generateRecipe(recipeModel);
      setGeneratedRecipe(data.recipe);
      setEditingRecipe(data.recipe);
    } catch (e) {
      alert('Failed to generate recipe: ' + (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const saveRecipe = async () => {
    if (!editingRecipe) return;
    try {
      await api.createRecipe(editingRecipe);
      alert('Recipe saved successfully!');
      setGeneratedRecipe(null);
      setEditingRecipe(null);
      await loadData();
    } catch (e) {
      alert('Failed to save recipe: ' + (e as Error).message);
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

      <div className="grid md:grid-cols-2 gap-6">
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
                  Batch Size
                </label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  Tensor Parallel Size
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
              <div>
                <label className="block text-sm text-[var(--muted-foreground)] mb-1">
                  KV Cache Dtype
                </label>
                <select
                  value={kvDtype}
                  onChange={(e) => setKvDtype(e.target.value as 'auto' | 'fp16' | 'fp8')}
                  className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="auto">Auto</option>
                  <option value="fp16">FP16</option>
                  <option value="fp8">FP8</option>
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
                    <span className="text-[var(--muted-foreground)]">Activation Memory</span>
                    <span className="font-mono">{vramResult.breakdown.activations_gb.toFixed(2)} GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Overhead</span>
                    <span className="font-mono">{vramResult.breakdown.overhead_gb.toFixed(2)} GB</span>
                  </div>
                  <div className="border-t border-[var(--border)] pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total per GPU</span>
                      <span className="font-mono text-[var(--foreground)]">
                        {vramResult.breakdown.per_gpu_gb.toFixed(2)} GB
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--muted-foreground)] mt-1">
                      <span>GPU Utilization</span>
                      <span className="font-mono">{vramResult.utilization_percent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={`mt-2 p-2 rounded ${
                    vramResult.fits
                      ? 'bg-[var(--success)]/10 text-[var(--success)]'
                      : 'bg-[var(--error)]/10 text-[var(--error)]'
                  }`}>
                    {vramResult.fits
                      ? 'This configuration will fit in GPU memory'
                      : 'This configuration may exceed available VRAM'}
                  </div>
                  {vramResult.recommendations && vramResult.recommendations.length > 0 && (
                    <div className="mt-3 text-xs text-[var(--muted-foreground)]">
                      <p className="font-medium mb-1">Recommendations:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {vramResult.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recipe Generator */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
          <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <Wand2 className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="font-medium">Recipe Generator</h2>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Model</label>
              <select
                value={recipeModel}
                onChange={(e) => setRecipeModel(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select a model...</option>
                {models.filter(m => !m.has_recipe).map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={generateRecipe}
              disabled={!recipeModel || generating}
              className="w-full py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Recipe'}
            </button>

            {editingRecipe && (
              <div className="mt-4 p-4 bg-[var(--background)] rounded-lg space-y-3">
                <h3 className="font-medium">Recipe Preview</h3>

                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">ID</label>
                  <input
                    type="text"
                    value={editingRecipe.id}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, id: e.target.value })}
                    className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">Name</label>
                  <input
                    type="text"
                    value={editingRecipe.name}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                    className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Backend</label>
                    <select
                      value={editingRecipe.backend}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, backend: e.target.value as 'vllm' | 'sglang' })}
                      className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="vllm">vLLM</option>
                      <option value="sglang">SGLang</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">TP Size</label>
                    <input
                      type="number"
                      value={editingRecipe.tensor_parallel_size || 1}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, tensor_parallel_size: parseInt(e.target.value) || 1 })}
                      className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Max Model Len</label>
                    <input
                      type="number"
                      value={editingRecipe.max_model_len || 0}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, max_model_len: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">GPU Mem Util</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={editingRecipe.gpu_memory_utilization || 0.9}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, gpu_memory_utilization: parseFloat(e.target.value) || 0.9 })}
                      className="w-full px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveRecipe}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[var(--success)] text-white rounded text-sm font-medium hover:opacity-90 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Save Recipe
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedRecipe(null);
                      setEditingRecipe(null);
                    }}
                    className="px-4 py-2 bg-[var(--card-hover)] rounded text-sm hover:bg-[var(--border)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
              No recipes yet. Generate one above!
            </div>
          ) : (
            recipes.map((recipe) => (
              <div key={recipe.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
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
                    TP: {recipe.tp || recipe.tensor_parallel_size || 1} | Context: {recipe.max_model_len?.toLocaleString()} | Mem: {((recipe.gpu_memory_utilization || 0.9) * 100).toFixed(0)}%
                  </div>
                </div>
                <button
                  onClick={() => deleteRecipe(recipe.id)}
                  disabled={recipe.is_running}
                  className="p-2 text-[var(--muted-foreground)] hover:text-[var(--error)] disabled:opacity-50 transition-colors"
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
