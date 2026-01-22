import Foundation

// MARK: - GPU Metric

/// Represents metrics for a single GPU
struct GPUMetric: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let index: Int
    let utilizationPercent: Double
    let memoryUsedGB: Double
    let memoryTotalGB: Double
    let temperatureCelsius: Double
    let powerWatts: Double?
    let powerLimitWatts: Double?

    /// Memory usage as a percentage (0-100)
    var memoryUsagePercent: Double {
        guard memoryTotalGB > 0 else { return 0 }
        return (memoryUsedGB / memoryTotalGB) * 100
    }

    /// Memory available in GB
    var memoryAvailableGB: Double {
        memoryTotalGB - memoryUsedGB
    }

    /// Temperature status based on thresholds
    var temperatureStatus: TemperatureStatus {
        switch temperatureCelsius {
        case ..<60:
            return .normal
        case 60..<80:
            return .warm
        case 80..<90:
            return .hot
        default:
            return .critical
        }
    }

    enum TemperatureStatus {
        case normal
        case warm
        case hot
        case critical

        var description: String {
            switch self {
            case .normal: return "Normal"
            case .warm: return "Warm"
            case .hot: return "Hot"
            case .critical: return "Critical"
            }
        }
    }
}

// MARK: - System Health

/// Overall system health status
struct SystemHealth: Codable, Equatable {
    let status: Status
    let serverVersion: String?
    let uptime: TimeInterval?
    let activeModelId: String?
    let activeModelName: String?
    let totalGPUs: Int
    let healthyGPUs: Int
    let lastChecked: Date

    enum Status: String, Codable {
        case healthy
        case degraded
        case unhealthy
        case unknown

        var description: String {
            switch self {
            case .healthy: return "Healthy"
            case .degraded: return "Degraded"
            case .unhealthy: return "Unhealthy"
            case .unknown: return "Unknown"
            }
        }
    }

    /// Whether the system is in a good state
    var isHealthy: Bool {
        status == .healthy
    }

    /// Formatted uptime string
    var formattedUptime: String? {
        guard let uptime = uptime else { return nil }
        let hours = Int(uptime) / 3600
        let minutes = (Int(uptime) % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    /// Static default for initial state
    static let unknown = SystemHealth(
        status: .unknown,
        serverVersion: nil,
        uptime: nil,
        activeModelId: nil,
        activeModelName: nil,
        totalGPUs: 0,
        healthyGPUs: 0,
        lastChecked: Date()
    )
}

// MARK: - Log Entry

/// A single log entry for recent logs preview
struct LogEntry: Codable, Identifiable, Equatable {
    let id: String
    let timestamp: Date
    let level: LogLevel
    let message: String
    let source: String?
    let sessionId: String?

    enum LogLevel: String, Codable {
        case debug
        case info
        case warning
        case error
        case critical

        var description: String {
            switch self {
            case .debug: return "DEBUG"
            case .info: return "INFO"
            case .warning: return "WARN"
            case .error: return "ERROR"
            case .critical: return "CRIT"
            }
        }
    }

    /// Truncated message for preview (max 100 characters)
    var truncatedMessage: String {
        if message.count > 100 {
            return String(message.prefix(97)) + "..."
        }
        return message
    }

    /// Formatted timestamp for display
    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: timestamp)
    }
}

// MARK: - Recipe (Minimal for Dashboard)

/// Recipe model for quick launch section
struct Recipe: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let modelId: String?
    let description: String?
    let isPinned: Bool
    let status: RecipeStatus
    let lastUsed: Date?
    let createdAt: Date
    let updatedAt: Date

    enum RecipeStatus: String, Codable {
        case ready
        case loading
        case running
        case error
        case stopped

        var description: String {
            switch self {
            case .ready: return "Ready"
            case .loading: return "Loading"
            case .running: return "Running"
            case .error: return "Error"
            case .stopped: return "Stopped"
            }
        }
    }

    /// Whether the recipe can be launched
    var canLaunch: Bool {
        status == .ready || status == .stopped
    }

    /// Whether the recipe is currently active
    var isActive: Bool {
        status == .loading || status == .running
    }
}

// MARK: - Connection Status

/// Server connection status
enum ConnectionStatus: Equatable {
    case connected
    case connecting
    case disconnected
    case error(String)

    var description: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting..."
        case .disconnected: return "Disconnected"
        case .error(let message): return "Error: \(message)"
        }
    }

    var isConnected: Bool {
        if case .connected = self {
            return true
        }
        return false
    }
}

// MARK: - WebSocket Messages

/// WebSocket message types for real-time updates
enum WSMessageType: String, Codable {
    case gpuMetrics = "gpu_metrics"
    case systemHealth = "system_health"
    case modelStatus = "model_status"
    case logEntry = "log_entry"
}

/// Wrapper for WebSocket messages
struct WSMessage: Codable {
    let type: WSMessageType
    let payload: Data

    func decode<T: Decodable>() throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: payload)
    }
}
