import SwiftUI

/// Tool selection bar with MCP server toggles, settings, and token counter
struct ToolBelt: View {
    let mcpEnabled: Bool
    let artifactsEnabled: Bool
    let mcpServers: [MCPServer]
    let selectedServers: Set<String>
    let sessionUsage: SessionUsage?
    let displayModel: String

    var onToggleMCP: (Bool) -> Void
    var onToggleArtifacts: (Bool) -> Void
    var onToggleServer: (String) -> Void
    var onOpenSettings: () -> Void
    var onOpenMCPSettings: () -> Void
    var onOpenUsageDetails: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        if sizeClass == .regular {
            iPadToolBelt
        } else {
            iPhoneToolBelt
        }
    }

    // MARK: - iPad Layout

    private var iPadToolBelt: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Model and settings row
            HStack {
                ModelBadge(model: displayModel)

                Spacer()

                HStack(spacing: .spacing.sm) {
                    // Token usage
                    if let usage = sessionUsage {
                        TokenUsageBadge(usage: usage, onTap: onOpenUsageDetails)
                    }

                    // Settings button
                    ToolBeltButton(
                        icon: "gearshape",
                        label: "Settings",
                        action: onOpenSettings
                    )
                }
            }

            Divider()
                .background(Color.theme.border)

            // Tools row
            HStack(spacing: .spacing.md) {
                // MCP Toggle
                ToolToggle(
                    label: "MCP Tools",
                    icon: "wrench.and.screwdriver",
                    isEnabled: mcpEnabled,
                    onToggle: onToggleMCP
                )

                // Artifacts Toggle
                ToolToggle(
                    label: "Artifacts",
                    icon: "cube",
                    isEnabled: artifactsEnabled,
                    onToggle: onToggleArtifacts
                )

                Spacer()

                // MCP Settings button
                if mcpEnabled {
                    ToolBeltButton(
                        icon: "slider.horizontal.3",
                        label: "Configure MCP",
                        action: onOpenMCPSettings
                    )
                }
            }

            // MCP Server toggles (if enabled)
            if mcpEnabled && !mcpServers.isEmpty {
                MCPServerToggles(
                    servers: mcpServers,
                    selectedServers: selectedServers,
                    onToggle: onToggleServer
                )
            }
        }
        .padding(.spacing.md)
        .background(Color.theme.card)
        .clipShape(RoundedRectangle(cornerRadius: .radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    // MARK: - iPhone Layout

    private var iPhoneToolBelt: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.md) {
                // Model badge
                ModelBadge(model: displayModel)

                Divider()
                    .frame(height: 24)
                    .background(Color.theme.border)

                // MCP Toggle
                CompactToolToggle(
                    label: "MCP",
                    icon: "wrench.and.screwdriver",
                    isEnabled: mcpEnabled,
                    onToggle: onToggleMCP
                )

                // Artifacts Toggle
                CompactToolToggle(
                    label: "Artifacts",
                    icon: "cube",
                    isEnabled: artifactsEnabled,
                    onToggle: onToggleArtifacts
                )

                // Token usage
                if let usage = sessionUsage {
                    Divider()
                        .frame(height: 24)
                        .background(Color.theme.border)

                    CompactTokenBadge(usage: usage)
                }

                // Settings
                Button(action: onOpenSettings) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.theme.mutedForeground)
                }
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
        }
        .background(Color.theme.backgroundSecondary)
    }
}

// MARK: - Model Badge

struct ModelBadge: View {
    let model: String

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Circle()
                .fill(Color.theme.success)
                .frame(width: 8, height: 8)

            Text(model)
                .font(.theme.caption.weight(.medium))
                .foregroundStyle(Color.theme.foreground)
                .lineLimit(1)
        }
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xs)
        .background(Color.theme.backgroundSecondary)
        .clipShape(Capsule())
    }
}

// MARK: - Tool Toggle

struct ToolToggle: View {
    let label: String
    let icon: String
    let isEnabled: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isEnabled)
        } label: {
            HStack(spacing: .spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14))

                Text(label)
                    .font(.theme.caption.weight(.medium))

                Image(systemName: isEnabled ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 14))
            }
            .foregroundStyle(isEnabled ? Color.theme.primary : Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(isEnabled ? Color.theme.primary.opacity(0.15) : Color.theme.backgroundSecondary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Compact Tool Toggle (iPhone)

struct CompactToolToggle: View {
    let label: String
    let icon: String
    let isEnabled: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isEnabled)
        } label: {
            HStack(spacing: .spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 12))

                Text(label)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(isEnabled ? Color.theme.primary : Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(isEnabled ? Color.theme.primary.opacity(0.15) : .clear)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tool Belt Button

struct ToolBeltButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 12))

                Text(label)
                    .font(.theme.caption)
            }
            .foregroundStyle(Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color.theme.backgroundSecondary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Token Usage Badge

struct TokenUsageBadge: View {
    let usage: SessionUsage
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: .spacing.sm) {
                Image(systemName: "chart.bar")
                    .font(.system(size: 12))

                VStack(alignment: .leading, spacing: 0) {
                    Text("\(formatTokens(usage.totalTokens)) tokens")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))

                    if let cost = usage.estimatedCostUSD {
                        Text("$\(String(format: "%.4f", cost))")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color.theme.mutedForeground)
                    }
                }
            }
            .foregroundStyle(Color.theme.foreground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color.theme.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        }
        .buttonStyle(.plain)
    }

    private func formatTokens(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1000 {
            return String(format: "%.1fk", Double(count) / 1000)
        }
        return "\(count)"
    }
}

// MARK: - Compact Token Badge (iPhone)

struct CompactTokenBadge: View {
    let usage: SessionUsage

    var body: some View {
        Text("\(formatTokens(usage.totalTokens))")
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .foregroundStyle(Color.theme.mutedForeground)
    }

    private func formatTokens(_ count: Int) -> String {
        if count >= 1000 {
            return String(format: "%.1fk tok", Double(count) / 1000)
        }
        return "\(count) tok"
    }
}

// MARK: - MCP Server Toggles

struct MCPServerToggles: View {
    let servers: [MCPServer]
    let selectedServers: Set<String>
    let onToggle: (String) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                ForEach(servers) { server in
                    MCPServerToggle(
                        server: server,
                        isSelected: selectedServers.contains(server.id),
                        onToggle: { onToggle(server.id) }
                    )
                }
            }
        }
    }
}

struct MCPServerToggle: View {
    let server: MCPServer
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: .spacing.xs) {
                if let icon = server.icon {
                    Image(systemName: icon)
                        .font(.system(size: 12))
                } else {
                    Image(systemName: "server.rack")
                        .font(.system(size: 12))
                }

                Text(server.name)
                    .font(.theme.caption)

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                }
            }
            .foregroundStyle(isSelected ? Color.theme.primary : Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(isSelected ? Color.theme.primary.opacity(0.15) : Color.theme.backgroundTertiary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.theme.primary.opacity(0.3) : .clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Tool Belt - iPad") {
    ToolBelt(
        mcpEnabled: true,
        artifactsEnabled: true,
        mcpServers: [
            MCPServer(name: "Web Tools", command: "mcp-web"),
            MCPServer(name: "File Tools", command: "mcp-files"),
            MCPServer(name: "Code Tools", command: "mcp-code")
        ],
        selectedServers: ["Web Tools"],
        sessionUsage: SessionUsage(promptTokens: 1234, completionTokens: 567, totalTokens: 1801, estimatedCostUSD: 0.0023),
        displayModel: "Qwen2.5-72B-Instruct",
        onToggleMCP: { _ in },
        onToggleArtifacts: { _ in },
        onToggleServer: { _ in },
        onOpenSettings: {},
        onOpenMCPSettings: {},
        onOpenUsageDetails: {}
    )
    .padding()
    .background(Color.theme.background)
    .environment(\.horizontalSizeClass, .regular)
}

#Preview("Tool Belt - iPhone") {
    ToolBelt(
        mcpEnabled: true,
        artifactsEnabled: false,
        mcpServers: [],
        selectedServers: [],
        sessionUsage: SessionUsage(promptTokens: 500, completionTokens: 200, totalTokens: 700),
        displayModel: "Qwen2.5-72B",
        onToggleMCP: { _ in },
        onToggleArtifacts: { _ in },
        onToggleServer: { _ in },
        onOpenSettings: {},
        onOpenMCPSettings: {},
        onOpenUsageDetails: {}
    )
    .background(Color.theme.background)
    .environment(\.horizontalSizeClass, .compact)
}
