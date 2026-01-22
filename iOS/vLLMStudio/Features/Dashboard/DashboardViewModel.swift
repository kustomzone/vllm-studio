import Foundation
import Observation

/// View model for the Dashboard screen
@Observable
final class DashboardViewModel {
    // MARK: - State

    /// Current GPU metrics
    private(set) var gpuMetrics: [GPUMetric] = []

    /// Previous GPU metrics for change indicators
    private(set) var previousGPUMetrics: [String: GPUMetric] = [:]

    /// System health status
    private(set) var systemHealth: SystemHealth = .unknown

    /// Pinned recipes for quick launch
    private(set) var pinnedRecipes: [Recipe] = []

    /// Recent log entries
    private(set) var recentLogs: [LogEntry] = []

    /// Connection status
    private(set) var connectionStatus: ConnectionStatus = .disconnected

    /// Loading state
    private(set) var isLoading = false

    /// Error state
    private(set) var error: DashboardError?

    /// Last refresh timestamp
    private(set) var lastRefreshed: Date?

    // MARK: - Computed Properties

    /// Total VRAM used across all GPUs
    var totalMemoryUsed: Double {
        gpuMetrics.reduce(0) { $0 + $1.memoryUsedGB }
    }

    /// Total VRAM available across all GPUs
    var totalMemoryAvailable: Double {
        gpuMetrics.reduce(0) { $0 + $1.memoryAvailableGB }
    }

    /// Total VRAM capacity across all GPUs
    var totalMemoryCapacity: Double {
        gpuMetrics.reduce(0) { $0 + $1.memoryTotalGB }
    }

    /// Average GPU utilization
    var averageUtilization: Double {
        guard !gpuMetrics.isEmpty else { return 0 }
        return gpuMetrics.reduce(0) { $0 + $1.utilizationPercent } / Double(gpuMetrics.count)
    }

    /// Whether the dashboard has valid data
    var hasData: Bool {
        !gpuMetrics.isEmpty || systemHealth.status != .unknown
    }

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private var pollingTask: Task<Void, Never>?
    private let pollingInterval: TimeInterval = 5.0
    private let baseURL: URL

    // MARK: - Initialization

    init(baseURL: URL = URL(string: "http://localhost:8080")!) {
        self.baseURL = baseURL
    }

    deinit {
        disconnect()
    }

    // MARK: - Public Methods

    /// Refresh all dashboard data
    @MainActor
    func refresh() async {
        guard !isLoading else { return }

        isLoading = true
        error = nil

        do {
            // Fetch all data concurrently
            async let gpuTask = fetchGPUMetrics()
            async let healthTask = fetchSystemHealth()
            async let recipesTask = fetchPinnedRecipes()
            async let logsTask = fetchRecentLogs()

            let (gpus, health, recipes, logs) = try await (gpuTask, healthTask, recipesTask, logsTask)

            // Store previous metrics for change indicators
            for metric in gpuMetrics {
                previousGPUMetrics[metric.id] = metric
            }

            // Update state
            gpuMetrics = gpus
            systemHealth = health
            pinnedRecipes = recipes
            recentLogs = logs
            lastRefreshed = Date()
            connectionStatus = .connected

        } catch {
            self.error = .refreshFailed(error.localizedDescription)
            connectionStatus = .error(error.localizedDescription)
        }

        isLoading = false
    }

    /// Connect to WebSocket for real-time updates
    @MainActor
    func connectWebSocket() {
        guard connectionStatus != .connecting else { return }

        connectionStatus = .connecting

        let wsURL = baseURL.appendingPathComponent("ws/metrics")
        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: wsURL)

        webSocketTask?.resume()
        receiveWebSocketMessage()

        connectionStatus = .connected
    }

    /// Disconnect WebSocket and stop polling
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        pollingTask?.cancel()
        pollingTask = nil
        connectionStatus = .disconnected
    }

    /// Start polling for updates (fallback when WebSocket is not available)
    @MainActor
    func startPolling() {
        pollingTask?.cancel()

        pollingTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(nanoseconds: UInt64(5_000_000_000)) // 5 seconds
            }
        }
    }

    /// Stop polling
    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }

    /// Launch a recipe
    @MainActor
    func launchRecipe(_ recipe: Recipe) async {
        guard recipe.canLaunch else { return }

        // Update local state optimistically
        if let index = pinnedRecipes.firstIndex(where: { $0.id == recipe.id }) {
            pinnedRecipes[index] = Recipe(
                id: recipe.id,
                name: recipe.name,
                modelId: recipe.modelId,
                description: recipe.description,
                isPinned: recipe.isPinned,
                status: .loading,
                lastUsed: recipe.lastUsed,
                createdAt: recipe.createdAt,
                updatedAt: recipe.updatedAt
            )
        }

        do {
            try await performLaunchRecipe(recipe.id)
            await refresh()
        } catch {
            self.error = .launchFailed(recipe.name, error.localizedDescription)

            // Revert optimistic update
            if let index = pinnedRecipes.firstIndex(where: { $0.id == recipe.id }) {
                pinnedRecipes[index] = recipe
            }
        }
    }

    /// Stop a running recipe
    @MainActor
    func stopRecipe(_ recipe: Recipe) async {
        guard recipe.status == .running else { return }

        do {
            try await performStopRecipe(recipe.id)
            await refresh()
        } catch {
            self.error = .stopFailed(recipe.name, error.localizedDescription)
        }
    }

    /// Clear any displayed error
    func clearError() {
        error = nil
    }

    // MARK: - Private Methods - WebSocket

    private func receiveWebSocketMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                Task { @MainActor in
                    self.handleWebSocketMessage(message)
                }
                self.receiveWebSocketMessage() // Continue listening

            case .failure(let error):
                Task { @MainActor in
                    self.connectionStatus = .error(error.localizedDescription)
                    // Attempt reconnection after delay
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    self.connectWebSocket()
                }
            }
        }
    }

    @MainActor
    private func handleWebSocketMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .data(let data):
            parseWebSocketData(data)
        case .string(let string):
            if let data = string.data(using: .utf8) {
                parseWebSocketData(data)
            }
        @unknown default:
            break
        }
    }

    @MainActor
    private func parseWebSocketData(_ data: Data) {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        // Try to decode as GPU metrics array
        if let metrics = try? decoder.decode([GPUMetric].self, from: data) {
            for metric in gpuMetrics {
                previousGPUMetrics[metric.id] = metric
            }
            gpuMetrics = metrics
            return
        }

        // Try to decode as system health
        if let health = try? decoder.decode(SystemHealth.self, from: data) {
            systemHealth = health
            return
        }

        // Try to decode as wrapped message
        if let wsMessage = try? decoder.decode(WSMessage.self, from: data) {
            switch wsMessage.type {
            case .gpuMetrics:
                if let metrics: [GPUMetric] = try? wsMessage.decode() {
                    for metric in gpuMetrics {
                        previousGPUMetrics[metric.id] = metric
                    }
                    gpuMetrics = metrics
                }
            case .systemHealth:
                if let health: SystemHealth = try? wsMessage.decode() {
                    systemHealth = health
                }
            case .logEntry:
                if let log: LogEntry = try? wsMessage.decode() {
                    recentLogs.insert(log, at: 0)
                    if recentLogs.count > 100 {
                        recentLogs = Array(recentLogs.prefix(100))
                    }
                }
            case .modelStatus:
                // Trigger a refresh to get updated recipe status
                Task { await refresh() }
            }
        }
    }

    // MARK: - Private Methods - API Calls

    private func fetchGPUMetrics() async throws -> [GPUMetric] {
        let url = baseURL.appendingPathComponent("api/gpus")
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([GPUMetric].self, from: data)
    }

    private func fetchSystemHealth() async throws -> SystemHealth {
        let url = baseURL.appendingPathComponent("api/health")
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(SystemHealth.self, from: data)
    }

    private func fetchPinnedRecipes() async throws -> [Recipe] {
        let url = baseURL.appendingPathComponent("api/recipes")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: true)!
        components.queryItems = [URLQueryItem(name: "pinned", value: "true")]

        let (data, response) = try await URLSession.shared.data(from: components.url!)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([Recipe].self, from: data)
    }

    private func fetchRecentLogs() async throws -> [LogEntry] {
        let url = baseURL.appendingPathComponent("api/logs/recent")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: true)!
        components.queryItems = [URLQueryItem(name: "limit", value: "5")]

        let (data, response) = try await URLSession.shared.data(from: components.url!)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([LogEntry].self, from: data)
    }

    private func performLaunchRecipe(_ recipeId: String) async throws {
        let url = baseURL.appendingPathComponent("api/recipes/\(recipeId)/launch")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }
    }

    private func performStopRecipe(_ recipeId: String) async throws {
        let url = baseURL.appendingPathComponent("api/recipes/\(recipeId)/stop")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw DashboardError.invalidResponse
        }
    }
}

// MARK: - Dashboard Error

/// Errors that can occur in the dashboard
enum DashboardError: LocalizedError, Equatable {
    case refreshFailed(String)
    case invalidResponse
    case connectionLost
    case launchFailed(String, String)
    case stopFailed(String, String)

    var errorDescription: String? {
        switch self {
        case .refreshFailed(let reason):
            return "Failed to refresh dashboard: \(reason)"
        case .invalidResponse:
            return "Received invalid response from server"
        case .connectionLost:
            return "Connection to server lost"
        case .launchFailed(let recipe, let reason):
            return "Failed to launch \(recipe): \(reason)"
        case .stopFailed(let recipe, let reason):
            return "Failed to stop \(recipe): \(reason)"
        }
    }
}

// MARK: - Preview Helpers

extension DashboardViewModel {
    /// Create a view model with mock data for previews
    static var preview: DashboardViewModel {
        let viewModel = DashboardViewModel()

        viewModel.gpuMetrics = [
            GPUMetric(
                id: "gpu-0",
                name: "NVIDIA RTX 4090",
                index: 0,
                utilizationPercent: 75,
                memoryUsedGB: 18.5,
                memoryTotalGB: 24,
                temperatureCelsius: 65,
                powerWatts: 350,
                powerLimitWatts: 450
            ),
            GPUMetric(
                id: "gpu-1",
                name: "NVIDIA RTX 4090",
                index: 1,
                utilizationPercent: 45,
                memoryUsedGB: 12.0,
                memoryTotalGB: 24,
                temperatureCelsius: 55,
                powerWatts: 280,
                powerLimitWatts: 450
            )
        ]

        viewModel.systemHealth = SystemHealth(
            status: .healthy,
            serverVersion: "1.0.0",
            uptime: 3600 * 24 + 1800,
            activeModelId: "model-1",
            activeModelName: "Llama-3.1-70B",
            totalGPUs: 2,
            healthyGPUs: 2,
            lastChecked: Date()
        )

        viewModel.pinnedRecipes = [
            Recipe(
                id: "1",
                name: "Llama 3.1 70B",
                modelId: "meta-llama/Llama-3.1-70B",
                description: "Large language model",
                isPinned: true,
                status: .running,
                lastUsed: Date(),
                createdAt: Date(),
                updatedAt: Date()
            ),
            Recipe(
                id: "2",
                name: "Qwen 2.5 32B",
                modelId: "Qwen/Qwen2.5-32B",
                description: nil,
                isPinned: true,
                status: .ready,
                lastUsed: Date(),
                createdAt: Date(),
                updatedAt: Date()
            )
        ]

        viewModel.recentLogs = [
            LogEntry(
                id: "1",
                timestamp: Date(),
                level: .info,
                message: "Model loaded successfully",
                source: "ModelLoader",
                sessionId: nil
            ),
            LogEntry(
                id: "2",
                timestamp: Date().addingTimeInterval(-60),
                level: .warning,
                message: "High memory usage detected",
                source: "GPUMonitor",
                sessionId: nil
            )
        ]

        viewModel.connectionStatus = .connected
        viewModel.lastRefreshed = Date()

        return viewModel
    }
}
