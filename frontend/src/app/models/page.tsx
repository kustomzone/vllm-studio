'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, FileText, Check, X, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import type { ModelInfo } from '@/lib/types';

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('modelNotes');
    if (stored) setNotes(JSON.parse(stored));
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const data = await api.getModels();
      setModels(data.models || []);
    } catch (e) {
      console.error('Failed to load models:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = filter
    ? models.filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
    : models;

  const openNotes = (modelPath: string) => {
    setEditingNotes(modelPath);
    setNoteText(notes[modelPath] || '');
  };

  const saveNotes = () => {
    if (!editingNotes) return;
    const updated = { ...notes };
    if (noteText.trim()) {
      updated[editingNotes] = noteText.trim();
    } else {
      delete updated[editingNotes];
    }
    setNotes(updated);
    localStorage.setItem('modelNotes', JSON.stringify(updated));
    setEditingNotes(null);
  };

  const generateRecipe = async (modelPath: string) => {
    setGenerating(modelPath);
    try {
      const data = await api.generateRecipe(modelPath);
      await api.createRecipe(data.recipe);
      await loadModels();
      alert(`Recipe created: ${data.recipe.id}`);
    } catch (e) {
      alert('Failed to generate recipe: ' + (e as Error).message);
    } finally {
      setGenerating(null);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Model Browser</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models..."
            className="pl-10 pr-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] w-64"
          />
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Quant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Context</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Recipe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredModels.map((model) => (
                <tr key={model.path} className="hover:bg-[var(--card-hover)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm truncate max-w-xs" title={model.name}>
                      {model.name}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] truncate max-w-xs">
                      {model.architecture?.replace('ForCausalLM', '') || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {model.size_gb ? `${model.size_gb}G` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {model.quantization || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {model.context_length ? `${Math.round(model.context_length / 1000)}k` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      model.has_recipe
                        ? 'bg-[var(--success)]/10 text-[var(--success)]'
                        : 'bg-[var(--card-hover)] text-[var(--muted-foreground)]'
                    }`}>
                      {model.has_recipe ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                      {model.has_recipe ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)] truncate max-w-xs">
                    {notes[model.path] || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openNotes(model.path)}
                        className="px-2 py-1 text-xs text-[var(--accent)] hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      {!model.has_recipe && (
                        <button
                          onClick={() => generateRecipe(model.path)}
                          disabled={generating === model.path}
                          className="flex items-center gap-1 px-2 py-1 bg-[var(--accent)] text-white rounded text-xs hover:bg-[var(--accent-hover)] disabled:opacity-50"
                        >
                          <Plus className="h-3 w-3" />
                          {generating === model.path ? '...' : 'Recipe'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-[var(--muted-foreground)]">
        {filteredModels.length} models in /mnt/llm_models
      </div>

      {/* Notes Modal */}
      {editingNotes && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-medium">Model Notes</h3>
              <button onClick={() => setEditingNotes(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add notes about this model..."
                rows={4}
                className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
              <button
                onClick={() => setEditingNotes(null)}
                className="px-4 py-2 text-sm hover:bg-[var(--card-hover)] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:bg-[var(--accent-hover)]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
