//
//  MCPService.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

/// Service for managing Model Context Protocol (MCP) servers and tools.
@Observable
final class MCPService {

    // MARK: - Singleton

    static let shared = MCPService()

    // MARK: - Properties

    /// Available MCP servers
    var servers: [MCPServer] = []

    /// Tools available from all connected servers
    var allTools: [MCPTool] = []

    /// Currently executing tool calls
    var pendingToolCalls: [String: ToolCallStatus] = [:]

    /// Whether data is loading
    var isLoading: Bool = false

    /// Error message
    var errorMessage: String?

    // MARK: - Computed Properties

    /// Connected servers
    var connectedServers: [MCPServer] {
        servers.filter { $0.status == .connected }
    }

    /// Total tool count
    var totalToolCount: Int {
        servers.reduce(0) { $0 + ($1.toolCount ?? 0) }
    }

    // MARK: - Initialization

    private init() {}

    // MARK: - Server Management

    /// Fetches all MCP servers
    @MainActor
    func fetchServers() async throws {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: MCPServersResponse = try await APIClient.shared.request(.mcpServers)
            servers = response.servers
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    /// Fetches tools for a specific server
    /// - Parameter serverId: The server ID
    /// - Returns: List of tools
    @MainActor
    func fetchTools(for serverId: String) async throws -> [MCPTool] {
        let response: MCPToolsResponse = try await APIClient.shared.request(
            .mcpTools(serverId: serverId)
        )
        return response.tools
    }

    /// Fetches tools for all connected servers
    @MainActor
    func fetchAllTools() async throws {
        var tools: [MCPTool] = []

        for server in connectedServers {
            do {
                let serverTools = try await fetchTools(for: server.id)
                tools.append(contentsOf: serverTools)
            } catch {
                print("Failed to fetch tools for server \(server.name): \(error)")
            }
        }

        allTools = tools
    }

    // MARK: - Tool Execution

    /// Executes an MCP tool
    /// - Parameters:
    ///   - serverId: The server ID
    ///   - toolName: The tool name
    ///   - arguments: The tool arguments
    /// - Returns: The tool execution result
    @MainActor
    func executeTool(
        serverId: String,
        toolName: String,
        arguments: [String: Any]
    ) async throws -> MCPToolResult {
        let callId = UUID().uuidString
        pendingToolCalls[callId] = .running

        defer {
            pendingToolCalls.removeValue(forKey: callId)
        }

        do {
            let request = ExecuteToolRequest(arguments: arguments)
            let result: MCPToolResult = try await APIClient.shared.request(
                .executeTool(serverId: serverId, toolName: toolName),
                body: request
            )
            pendingToolCalls[callId] = .completed
            return result
        } catch {
            pendingToolCalls[callId] = .failed
            throw error
        }
    }

    // MARK: - Tool Search

    /// Searches tools by query
    /// - Parameter query: The search query
    /// - Returns: Matching tools
    func searchTools(query: String) -> [MCPTool] {
        guard !query.isEmpty else { return allTools }

        let lowercased = query.lowercased()
        return allTools.filter { tool in
            tool.name.lowercased().contains(lowercased) ||
            tool.description.lowercased().contains(lowercased)
        }
    }

    /// Filters tools by server
    /// - Parameter serverId: The server ID to filter by
    /// - Returns: Tools from the specified server
    func filterTools(byServer serverId: String?) -> [MCPTool] {
        guard let serverId = serverId else { return allTools }
        return allTools.filter { $0.serverId == serverId }
    }
}

// MARK: - Response Types

struct MCPServersResponse: Decodable {
    let servers: [MCPServer]
}

struct MCPToolsResponse: Decodable {
    let tools: [MCPTool]
}

struct ExecuteToolRequest: Encodable {
    let arguments: [String: AnyCodable]

    init(arguments: [String: Any]) {
        self.arguments = arguments.mapValues { AnyCodable($0) }
    }
}

// MARK: - MCP Server

struct MCPServer: Identifiable, Codable {
    let id: String
    let name: String
    let description: String?
    let status: MCPServerStatus
    let toolCount: Int?
    let lastConnected: Date?
    let version: String?
    let capabilities: [String]?

    enum MCPServerStatus: String, Codable {
        case connected
        case disconnected
        case error
        case connecting
    }

    var isConnected: Bool {
        status == .connected
    }

    var statusIcon: String {
        switch status {
        case .connected: return "checkmark.circle.fill"
        case .disconnected: return "circle"
        case .error: return "exclamationmark.circle.fill"
        case .connecting: return "arrow.clockwise"
        }
    }

    var statusColor: String {
        switch status {
        case .connected: return "success"
        case .disconnected: return "mutedForeground"
        case .error: return "error"
        case .connecting: return "warning"
        }
    }
}

// MARK: - MCP Tool

struct MCPTool: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let serverId: String
    let serverName: String?
    let inputSchema: ToolInputSchema?
    let examples: [ToolExample]?

    struct ToolInputSchema: Codable {
        let type: String
        let properties: [String: ToolProperty]?
        let required: [String]?
    }

    struct ToolProperty: Codable {
        let type: String
        let description: String?
        let enumValues: [String]?

        enum CodingKeys: String, CodingKey {
            case type
            case description
            case enumValues = "enum"
        }
    }

    struct ToolExample: Codable {
        let input: [String: String]?
        let output: String?
    }

    /// Whether this tool has required parameters
    var hasRequiredParams: Bool {
        guard let required = inputSchema?.required else { return false }
        return !required.isEmpty
    }

    /// Number of parameters
    var paramCount: Int {
        inputSchema?.properties?.count ?? 0
    }
}

// MARK: - Tool Result

struct MCPToolResult: Decodable {
    let success: Bool
    let content: String?
    let error: String?
    let executionTime: TimeInterval?
    let metadata: [String: String]?

    var displayContent: String {
        if success {
            return content ?? "Tool executed successfully"
        } else {
            return error ?? "Tool execution failed"
        }
    }
}

// MARK: - Tool Call Status

enum ToolCallStatus: String {
    case pending
    case running
    case completed
    case failed
}

// MARK: - AnyCodable Helper

/// Helper struct for encoding arbitrary values
struct AnyCodable: Encodable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
