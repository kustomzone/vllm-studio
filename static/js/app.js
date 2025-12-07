/**
 * vLLM Studio - Main Application
 * Handles routing, initialization, and global state
 */

const App = {
    views: ['dashboard', 'chat', 'logs', 'recipes'],
    refreshInterval: null,

    async init() {
        console.log('vLLM Studio initializing...');

        // Initialize components
        Toast.init();
        this.setupNavigation();
        this.setupKeyboardShortcuts();

        // Load initial data
        await this.loadData();

        // Show default view
        this.showView(State.get('currentView') || 'dashboard');

        // Start auto-refresh
        this.startAutoRefresh();

        console.log('vLLM Studio ready');
    },

    setupNavigation() {
        // Setup nav item clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                if (view) this.showView(view);
            });
        });

        // Mobile menu toggle
        const menuBtn = document.getElementById('menuToggle');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('open');
            });
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape closes modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }

            // Ctrl+1-4 for quick view switching
            if (e.ctrlKey && e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                const viewIndex = parseInt(e.key) - 1;
                if (this.views[viewIndex]) {
                    this.showView(this.views[viewIndex]);
                }
            }

            // Ctrl+R to refresh
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refresh();
            }
        });
    },

    showView(viewName) {
        if (!this.views.includes(viewName)) return;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show selected view
        const viewEl = document.getElementById(`${viewName}-view`);
        if (viewEl) {
            viewEl.classList.remove('hidden');
        }

        // Update state
        State.set('currentView', viewName);

        // Run view-specific initialization
        this.initView(viewName);
    },

    initView(viewName) {
        switch (viewName) {
            case 'dashboard':
                Dashboard.refresh();
                break;
            case 'chat':
                Chat.init();
                break;
            case 'logs':
                Logs.refresh();
                break;
            case 'recipes':
                Recipes.refresh();
                break;
        }
    },

    async loadData() {
        try {
            const [health, status, recipes] = await Promise.all([
                API.getHealth(),
                API.getStatus(),
                API.getRecipes()
            ]);

            State.set('health', health);
            State.set('runningProcess', status.running_process);
            State.set('recipes', recipes);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            Toast.error('Failed to connect to API');
        }
    },

    async refresh() {
        Toast.info('Refreshing...');
        await this.loadData();
        this.initView(State.get('currentView'));
        Toast.success('Refreshed');
    },

    startAutoRefresh() {
        // Refresh every 10 seconds
        this.refreshInterval = setInterval(() => {
            this.loadData();
        }, 10000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    },

    // Global actions
    async evictModel() {
        if (!confirm('Evict the current model?')) return;

        try {
            await API.evictModel(true);
            Toast.success('Model evicted');
            await this.loadData();
            Dashboard.refresh();
        } catch (error) {
            Toast.error(`Failed to evict: ${error.message}`);
        }
    },

    async launchRecipe(recipeId) {
        try {
            Toast.info('Launching model...');
            const result = await API.switchModel(recipeId, true);
            Toast.success(result.message || 'Model launch initiated');
            await this.loadData();
            Dashboard.refresh();
        } catch (error) {
            Toast.error(`Failed to launch: ${error.message}`);
        }
    }
};

// ==========================================
// Dashboard Component
// ==========================================

const Dashboard = {
    refresh() {
        this.updateModelStatus();
        this.updateSystemStatus();
        this.updateRecipeList();
    },

    updateModelStatus() {
        const container = document.getElementById('current-model');
        if (!container) return;

        const process = State.get('runningProcess');

        if (process) {
            const modelName = Utils.getModelName(process.model_path);
            container.innerHTML = `
                <div class="model-name">${Utils.escapeHtml(modelName)}</div>
                <div class="model-info text-muted text-sm mt-4">
                    <div class="flex items-center gap-4">
                        <span>PID: ${process.pid}</span>
                        <span>Backend: ${process.backend}</span>
                        <span>Port: ${process.port}</span>
                        <span>Memory: ${process.memory_gb?.toFixed(2) || '?'} GB</span>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="model-name text-muted">No model running</div>
                <div class="model-info text-sm text-muted mt-4">
                    Select a recipe to launch a model
                </div>
            `;
        }
    },

    updateSystemStatus() {
        const container = document.getElementById('system-status');
        if (!container) return;

        const health = State.get('health');
        const recipes = State.get('recipes') || [];

        if (health) {
            container.innerHTML = `
                <div class="flex items-center gap-3 mb-4">
                    <span class="status-dot ${health.backend_reachable ? 'success' : 'danger'}"></span>
                    <span>Backend ${health.backend_reachable ? 'Online' : 'Offline'}</span>
                </div>
                <div class="flex items-center gap-3 mb-4">
                    <span class="status-dot ${health.proxy_reachable ? 'success' : 'warning'}"></span>
                    <span>Proxy ${health.proxy_reachable ? 'Online' : 'Offline'}</span>
                </div>
                <div class="text-sm text-muted">
                    <div>Version: ${health.version || '?'}</div>
                    <div>Recipes: ${recipes.length}</div>
                </div>
            `;
        }
    },

    updateRecipeList() {
        const container = document.getElementById('recipe-quick-list');
        if (!container) return;

        const recipes = State.get('recipes') || [];

        if (recipes.length === 0) {
            container.innerHTML = '<p class="text-muted">No recipes found</p>';
            return;
        }

        container.innerHTML = recipes.slice(0, 5).map(r => `
            <div class="recipe-item ${r.status === 'running' ? 'running' : ''}"
                 onclick="App.launchRecipe('${r.id}')">
                <div>
                    <div class="recipe-name">${Utils.escapeHtml(r.name)}</div>
                    <div class="recipe-meta">TP${r.tensor_parallel_size} | ${r.backend}</div>
                </div>
                <span class="status-badge ${r.status === 'running' ? 'success' : 'info'}">
                    ${r.status}
                </span>
            </div>
        `).join('');
    }
};

// ==========================================
// Chat Component
// ==========================================

const Chat = {
    initialized: false,

    init() {
        if (this.initialized) return;

        const form = document.getElementById('chat-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        this.initialized = true;
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;

        // Clear input
        input.value = '';

        // Add user message
        this.addMessage('user', message);

        // Get selected model
        const recipes = State.get('recipes') || [];
        const running = recipes.find(r => r.status === 'running');
        const model = running ? running.model_path : 'default';

        // Add assistant placeholder
        const assistantEl = this.addMessage('assistant', '');

        try {
            let fullResponse = '';

            await API.chatStream({
                model: model,
                messages: [{ role: 'user', content: message }]
            }, (chunk) => {
                fullResponse += chunk;
                assistantEl.innerHTML = Utils.simpleMarkdown(fullResponse);
                this.scrollToBottom();
            });
        } catch (error) {
            assistantEl.innerHTML = `<span class="text-danger">Error: ${Utils.escapeHtml(error.message)}</span>`;
        }
    },

    addMessage(role, content) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `chat-message ${role}`;
        div.innerHTML = Utils.simpleMarkdown(content);
        container.appendChild(div);
        this.scrollToBottom();
        return div;
    },

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },

    clear() {
        const container = document.getElementById('chat-messages');
        if (container) {
            container.innerHTML = '';
        }
    }
};

// ==========================================
// Logs Component
// ==========================================

const Logs = {
    currentRecipe: null,
    pollInterval: null,

    async refresh() {
        await this.loadLogFiles();
    },

    async loadLogFiles() {
        const container = document.getElementById('log-files');
        if (!container) return;

        try {
            const result = await API.getLogFiles();
            const logs = result.logs || [];

            if (logs.length === 0) {
                container.innerHTML = '<p class="text-muted">No log files found</p>';
                return;
            }

            container.innerHTML = logs.map(log => `
                <div class="recipe-item" onclick="Logs.viewLogs('${log.recipe_id}')">
                    <div>
                        <div class="recipe-name">${Utils.escapeHtml(log.recipe_id)}</div>
                        <div class="recipe-meta">${Utils.formatBytes(log.size)}</div>
                    </div>
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); Logs.downloadLog('${log.recipe_id}')">
                        ${Icons.download}
                    </button>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<p class="text-danger">Failed to load logs</p>`;
        }
    },

    async viewLogs(recipeId) {
        this.currentRecipe = recipeId;
        await this.loadLogs();

        // Start polling for updates
        this.startPolling();
    },

    async loadLogs() {
        if (!this.currentRecipe) return;

        const container = document.getElementById('log-content');
        if (!container) return;

        try {
            const result = await API.getLogs(this.currentRecipe, 200);
            const logs = result.logs || [];

            container.innerHTML = logs.map(line => {
                let type = '';
                if (line.includes('ERROR') || line.includes('error')) type = 'error';
                else if (line.includes('INFO')) type = 'info';
                else if (line.includes('WARNING')) type = 'warning';
                else if (line.includes('success') || line.includes('ready')) type = 'success';

                return `<div class="log-line ${type}">${Utils.escapeHtml(line)}</div>`;
            }).join('');

            container.scrollTop = container.scrollHeight;
        } catch (error) {
            container.innerHTML = `<div class="log-line error">Failed to load logs: ${error.message}</div>`;
        }
    },

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.loadLogs(), 2000);
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    downloadLog(recipeId) {
        const logPath = `/tmp/vllm_${recipeId}.log`;
        Toast.info(`Log file: ${logPath}`);
    }
};

// ==========================================
// Recipes Component
// ==========================================

const Recipes = {
    editingRecipe: null,

    async refresh() {
        const container = document.getElementById('recipes-list');
        if (!container) return;

        const recipes = State.get('recipes') || [];

        if (recipes.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <p>No recipes found</p>
                    <button class="btn btn-primary mt-4" onclick="Recipes.openModal()">
                        Create Recipe
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = recipes.map(r => `
            <div class="recipe-item ${r.status === 'running' ? 'running' : ''}"
                 onclick="Recipes.edit('${r.id}')">
                <div>
                    <div class="recipe-name">${Utils.escapeHtml(r.name)}</div>
                    <div class="recipe-meta">
                        ${Utils.getModelName(r.model_path)} |
                        TP${r.tensor_parallel_size} PP${r.pipeline_parallel_size} |
                        ${r.backend}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="status-badge ${r.status === 'running' ? 'success' : 'info'}">${r.status}</span>
                    ${r.status !== 'running' ? `
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); App.launchRecipe('${r.id}')">
                            Launch
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    openModal(recipe = null) {
        this.editingRecipe = recipe;

        const modal = document.getElementById('recipe-modal');
        const form = document.getElementById('recipe-form');
        const title = document.getElementById('recipe-modal-title');
        const deleteBtn = document.getElementById('recipe-delete-btn');

        if (recipe) {
            title.textContent = 'Edit Recipe';
            deleteBtn.classList.remove('hidden');
            this.populateForm(form, recipe);
        } else {
            title.textContent = 'New Recipe';
            deleteBtn.classList.add('hidden');
            form.reset();
        }

        modal.classList.add('active');
    },

    closeModal() {
        const modal = document.getElementById('recipe-modal');
        modal.classList.remove('active');
        this.editingRecipe = null;
    },

    populateForm(form, recipe) {
        form.querySelector('[name="id"]').value = recipe.id;
        form.querySelector('[name="id"]').disabled = true;
        form.querySelector('[name="name"]').value = recipe.name;
        form.querySelector('[name="model_path"]').value = recipe.model_path;
        form.querySelector('[name="backend"]').value = recipe.backend;
        form.querySelector('[name="tensor_parallel_size"]').value = recipe.tensor_parallel_size;
        form.querySelector('[name="pipeline_parallel_size"]').value = recipe.pipeline_parallel_size;
        form.querySelector('[name="max_model_len"]').value = recipe.max_model_len;
        form.querySelector('[name="gpu_memory_utilization"]').value = recipe.gpu_memory_utilization;
        form.querySelector('[name="kv_cache_dtype"]').value = recipe.kv_cache_dtype;
        form.querySelector('[name="tool_call_parser"]').value = recipe.tool_call_parser || '';
        form.querySelector('[name="quantization"]').value = recipe.quantization || '';
    },

    async edit(id) {
        try {
            const recipe = await API.getRecipe(id);
            this.openModal(recipe);
        } catch (error) {
            Toast.error(`Failed to load recipe: ${error.message}`);
        }
    },

    async save() {
        const form = document.getElementById('recipe-form');
        const data = {
            id: form.querySelector('[name="id"]').value,
            name: form.querySelector('[name="name"]').value,
            model_path: form.querySelector('[name="model_path"]').value,
            backend: form.querySelector('[name="backend"]').value,
            tensor_parallel_size: parseInt(form.querySelector('[name="tensor_parallel_size"]').value),
            pipeline_parallel_size: parseInt(form.querySelector('[name="pipeline_parallel_size"]').value),
            max_model_len: parseInt(form.querySelector('[name="max_model_len"]').value),
            gpu_memory_utilization: parseFloat(form.querySelector('[name="gpu_memory_utilization"]').value),
            kv_cache_dtype: form.querySelector('[name="kv_cache_dtype"]').value,
            tool_call_parser: form.querySelector('[name="tool_call_parser"]').value || null,
            quantization: form.querySelector('[name="quantization"]').value || null
        };

        try {
            if (this.editingRecipe) {
                await API.updateRecipe(data.id, data);
                Toast.success('Recipe updated');
            } else {
                await API.createRecipe(data);
                Toast.success('Recipe created');
            }

            this.closeModal();
            await App.loadData();
            this.refresh();
        } catch (error) {
            Toast.error(`Failed to save: ${error.message}`);
        }
    },

    async delete() {
        if (!this.editingRecipe || !confirm('Delete this recipe?')) return;

        try {
            await API.deleteRecipe(this.editingRecipe.id);
            Toast.success('Recipe deleted');
            this.closeModal();
            await App.loadData();
            this.refresh();
        } catch (error) {
            Toast.error(`Failed to delete: ${error.message}`);
        }
    }
};

// ==========================================
// Initialize on DOM Ready
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
