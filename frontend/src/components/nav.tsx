'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  FileText,
  Settings,
  MessageSquare,
  Menu,
  X,
  RefreshCw,
  Square,
  Play,
  Download,
  Upload
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/recipes', label: 'Recipes', icon: Settings },
  { href: '/logs', label: 'Logs', icon: FileText },
  { href: '/models', label: 'Models', icon: Layers },
];

export default function Nav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [status, setStatus] = useState<{ online: boolean; model?: string }>({ online: false });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const health = await api.getHealth();
        setStatus({
          online: health.backend_reachable,
          model: health.running_model?.split('/').pop(),
        });
      } catch {
        setStatus({ online: false });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    window.location.reload();
    setActionsOpen(false);
  };

  const handleEvict = async () => {
    if (!confirm('Stop the current model?')) return;
    try {
      await api.evictModel(true);
      window.location.reload();
    } catch (e) {
      alert('Failed to stop model: ' + (e as Error).message);
    }
    setActionsOpen(false);
  };

  const handleExport = async () => {
    try {
      const data = await api.exportRecipes();
      const blob = new Blob([JSON.stringify(data.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vllm-recipes.json';
      a.click();
    } catch (e) {
      alert('Export failed: ' + (e as Error).message);
    }
    setActionsOpen(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const recipes = data.recipes || [data];
        for (const r of recipes) {
          await api.createRecipe(r);
        }
        alert(`Imported ${recipes.length} recipe(s)`);
        window.location.reload();
      } catch (e) {
        alert('Import failed: ' + (e as Error).message);
      }
    };
    input.click();
    setActionsOpen(false);
  };

  return (
    <>
      {/* Desktop Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Logo & Nav Links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Layers className="h-5 w-5 text-[var(--accent)]" />
              <span>vLLM Studio</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--card-hover)] text-[var(--foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Status */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${status.online ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
              <span className="text-[var(--muted-foreground)]">
                {status.model || 'No model'}
              </span>
            </div>

            {/* Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--card-hover)] transition-colors"
              >
                Actions
                <Menu className="h-4 w-4" />
              </button>

              {actionsOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-lg z-50">
                    <button
                      onClick={handleRefresh}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-[var(--card-hover)]"
                    >
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                    <button
                      onClick={handleEvict}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-[var(--card-hover)]"
                    >
                      <Square className="h-4 w-4" /> Stop Model
                    </button>
                    <div className="border-t border-[var(--border)]" />
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-[var(--card-hover)]"
                    >
                      <Download className="h-4 w-4" /> Export Recipes
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-[var(--card-hover)]"
                    >
                      <Upload className="h-4 w-4" /> Import Recipes
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-[var(--card-hover)] rounded-md"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-[var(--border)] p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm ${
                    isActive
                      ? 'bg-[var(--card-hover)] text-[var(--foreground)]'
                      : 'text-[var(--muted-foreground)]'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--card)]">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-3 px-4 text-xs ${
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--muted-foreground)]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
