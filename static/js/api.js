/**
 * vLLM Studio API Client
 * Centralized API calls with error handling
 */

const API = {
    baseUrl: '',  // Same origin

    /**
     * Make an API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} - Response data
     */
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Request failed' }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            // Handle empty responses
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // ==========================================
    // Health & Status
    // ==========================================

    async getHealth() {
        return this.request('/health');
    },

    async getStatus() {
        return this.request('/status');
    },

    // ==========================================
    // Recipes
    // ==========================================

    async getRecipes() {
        return this.request('/recipes');
    },

    async getRecipe(id) {
        return this.request(`/recipes/${id}`);
    },

    async createRecipe(recipe) {
        return this.request('/recipes', {
            method: 'POST',
            body: JSON.stringify(recipe)
        });
    },

    async updateRecipe(id, recipe) {
        return this.request(`/recipes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(recipe)
        });
    },

    async deleteRecipe(id) {
        return this.request(`/recipes/${id}`, {
            method: 'DELETE'
        });
    },

    // ==========================================
    // Model Management
    // ==========================================

    async getModels() {
        return this.request('/models');
    },

    async getRunningModel() {
        return this.request('/models/running');
    },

    async getProcesses() {
        return this.request('/processes');
    },

    async switchModel(recipeId, force = false) {
        return this.request('/switch', {
            method: 'POST',
            body: JSON.stringify({ recipe_id: recipeId, force })
        });
    },

    async launchRecipe(recipeId, force = false) {
        return this.request(`/launch/${recipeId}?force=${force}`, {
            method: 'POST'
        });
    },

    async evictModel(force = false) {
        return this.request(`/evict?force=${force}`, {
            method: 'POST'
        });
    },

    async waitForReady(timeout = 300) {
        return this.request(`/wait-ready?timeout=${timeout}`);
    },

    // ==========================================
    // Logs
    // ==========================================

    async getLogFiles() {
        return this.request('/logs');
    },

    async getLogs(recipeId, lines = 100) {
        return this.request(`/logs/${recipeId}?lines=${lines}`);
    },

    // ==========================================
    // Chat / Inference
    // ==========================================

    /**
     * Send a chat completion request with streaming
     * @param {Object} params - Chat parameters
     * @param {Function} onChunk - Callback for each streamed chunk
     * @returns {Promise<void>}
     */
    async chatStream(params, onChunk) {
        const response = await fetch(this.baseUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            onChunk(content);
                        }
                    } catch (e) {
                        // Ignore parse errors for incomplete chunks
                    }
                }
            }
        }
    },

    /**
     * Non-streaming chat completion
     * @param {Object} params - Chat parameters
     * @returns {Promise<Object>} - Full response
     */
    async chat(params) {
        return this.request('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                stream: false
            })
        });
    },

    /**
     * Get available models from the backend
     * @returns {Promise<Object>}
     */
    async getBackendModels() {
        return this.request('/v1/models');
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
