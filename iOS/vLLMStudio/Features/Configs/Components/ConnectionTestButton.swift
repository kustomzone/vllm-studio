import SwiftUI

// MARK: - Connection Status

enum ConnectionStatus: Equatable {
    case disconnected
    case connecting
    case connected
    case failed(String)

    var isConnected: Bool {
        if case .connected = self { return true }
        return false
    }

    var isConnecting: Bool {
        if case .connecting = self { return true }
        return false
    }

    var statusColor: Color {
        switch self {
        case .disconnected:
            return Color.theme.mutedForeground
        case .connecting:
            return Color.theme.warning
        case .connected:
            return Color.theme.success
        case .failed:
            return Color.theme.error
        }
    }

    var statusIcon: String {
        switch self {
        case .disconnected:
            return "wifi.slash"
        case .connecting:
            return "wifi"
        case .connected:
            return "checkmark.circle.fill"
        case .failed:
            return "exclamationmark.triangle.fill"
        }
    }

    var statusText: String {
        switch self {
        case .disconnected:
            return "Not Connected"
        case .connecting:
            return "Connecting..."
        case .connected:
            return "Connected"
        case .failed(let message):
            return message.isEmpty ? "Connection Failed" : message
        }
    }
}

// MARK: - Connection Test Button

struct ConnectionTestButton: View {
    var status: ConnectionStatus
    var lastTestTime: Date?
    var onTest: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section Header
            HStack {
                Label("Connection", systemImage: "network")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Spacer()

                ConnectionStatusBadge(status: status)
            }

            // Status Details
            VStack(alignment: .leading, spacing: .spacing.sm) {
                // Status Message
                HStack(spacing: .spacing.sm) {
                    Image(systemName: status.statusIcon)
                        .font(.system(size: 20))
                        .foregroundColor(status.statusColor)
                        .symbolEffect(.pulse, options: .repeating, isActive: status.isConnecting)

                    VStack(alignment: .leading, spacing: .spacing.xxs) {
                        Text(status.statusText)
                            .font(.theme.body)
                            .foregroundColor(Color.theme.foreground)

                        if let lastTest = lastTestTime {
                            Text("Last tested \(formattedTime(lastTest))")
                                .font(.theme.caption2)
                                .foregroundColor(Color.theme.mutedForeground)
                        }
                    }
                }
                .padding(.spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: .radius.md)
                        .fill(status.statusColor.opacity(0.1))
                )

                // Test Button
                Button(action: onTest) {
                    HStack(spacing: .spacing.sm) {
                        if status.isConnecting {
                            ProgressView()
                                .scaleEffect(0.8)
                                .tint(Color.theme.foreground)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 14, weight: .semibold))
                        }

                        Text(status.isConnecting ? "Testing..." : "Test Connection")
                            .font(.theme.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(Color.theme.foreground)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, .spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: .radius.md)
                            .fill(Color.theme.backgroundSecondary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: .radius.md)
                            .stroke(Color.theme.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(status.isConnecting)
            }
        }
        .padding(.spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: .radius.lg)
                .fill(Color.theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private func formattedTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Connection Status Badge

struct ConnectionStatusBadge: View {
    var status: ConnectionStatus

    var body: some View {
        HStack(spacing: .spacing.xs) {
            if status.isConnecting {
                ProgressView()
                    .scaleEffect(0.6)
                    .tint(status.statusColor)
            } else {
                Circle()
                    .fill(status.statusColor)
                    .frame(width: 8, height: 8)
            }

            Text(shortStatusText)
                .font(.theme.caption)
                .foregroundColor(status.statusColor)
        }
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: .radius.full)
                .fill(status.statusColor.opacity(0.15))
        )
    }

    private var shortStatusText: String {
        switch status {
        case .disconnected: return "Offline"
        case .connecting: return "Testing"
        case .connected: return "Online"
        case .failed: return "Failed"
        }
    }
}

// MARK: - Connection Test Result

struct ConnectionTestResult: View {
    var status: ConnectionStatus
    var latency: TimeInterval?
    var serverVersion: String?

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            // Status Header
            HStack(spacing: .spacing.sm) {
                Image(systemName: status.statusIcon)
                    .font(.system(size: 24))
                    .foregroundColor(status.statusColor)

                VStack(alignment: .leading, spacing: .spacing.xxs) {
                    Text(status.isConnected ? "Connection Successful" : "Connection Failed")
                        .font(.theme.headline)
                        .foregroundColor(Color.theme.foreground)

                    if case .failed(let message) = status {
                        Text(message)
                            .font(.theme.caption)
                            .foregroundColor(Color.theme.error)
                    }
                }
            }

            // Details (when connected)
            if status.isConnected {
                Divider()
                    .background(Color.theme.border)

                VStack(spacing: .spacing.xs) {
                    if let latency = latency {
                        DetailRowCompact(label: "Latency", value: String(format: "%.0fms", latency * 1000))
                    }

                    if let version = serverVersion {
                        DetailRowCompact(label: "Server Version", value: version)
                    }
                }
            }
        }
        .padding(.spacing.md)
        .background(
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(status.statusColor.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(status.statusColor.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Detail Row Compact

struct DetailRowCompact: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)
            Spacer()
            Text(value)
                .font(.theme.caption)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.foreground)
        }
    }
}

// MARK: - Inline Connection Test

struct InlineConnectionTest: View {
    var status: ConnectionStatus
    var onTest: () -> Void

    var body: some View {
        HStack(spacing: .spacing.md) {
            // Status indicator
            HStack(spacing: .spacing.sm) {
                Image(systemName: status.statusIcon)
                    .font(.system(size: .iconSize.md))
                    .foregroundColor(status.statusColor)
                    .symbolEffect(.pulse, options: .repeating, isActive: status.isConnecting)

                Text(status.statusText)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.foreground)
            }

            Spacer()

            // Test button
            Button {
                onTest()
            } label: {
                Text(status.isConnecting ? "Testing..." : "Test")
                    .font(.theme.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primary)
            }
            .disabled(status.isConnecting)
        }
    }
}

// MARK: - Server Health Indicator

struct ServerHealthIndicator: View {
    var isHealthy: Bool
    var responseTime: TimeInterval?

    var body: some View {
        HStack(spacing: .spacing.sm) {
            Circle()
                .fill(isHealthy ? Color.theme.success : Color.theme.error)
                .frame(width: 12, height: 12)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.3), lineWidth: 2)
                )

            VStack(alignment: .leading, spacing: 0) {
                Text(isHealthy ? "Healthy" : "Unhealthy")
                    .font(.theme.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.foreground)

                if let time = responseTime {
                    Text("\(Int(time * 1000))ms")
                        .font(.theme.caption2)
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Connection Test Button - Disconnected") {
    ConnectionTestButton(
        status: .disconnected,
        lastTestTime: nil,
        onTest: {}
    )
    .padding()
    .background(Color.theme.background)
}

#Preview("Connection Test Button - Connecting") {
    ConnectionTestButton(
        status: .connecting,
        lastTestTime: Date().addingTimeInterval(-300),
        onTest: {}
    )
    .padding()
    .background(Color.theme.background)
}

#Preview("Connection Test Button - Connected") {
    ConnectionTestButton(
        status: .connected,
        lastTestTime: Date().addingTimeInterval(-60),
        onTest: {}
    )
    .padding()
    .background(Color.theme.background)
}

#Preview("Connection Test Button - Failed") {
    ConnectionTestButton(
        status: .failed("Unable to reach server"),
        lastTestTime: Date().addingTimeInterval(-120),
        onTest: {}
    )
    .padding()
    .background(Color.theme.background)
}

#Preview("Connection Status Badges") {
    VStack(spacing: 16) {
        ConnectionStatusBadge(status: .disconnected)
        ConnectionStatusBadge(status: .connecting)
        ConnectionStatusBadge(status: .connected)
        ConnectionStatusBadge(status: .failed("Error"))
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Connection Test Result") {
    VStack(spacing: 16) {
        ConnectionTestResult(
            status: .connected,
            latency: 0.045,
            serverVersion: "vLLM 0.4.0"
        )

        ConnectionTestResult(
            status: .failed("Connection refused"),
            latency: nil,
            serverVersion: nil
        )
    }
    .padding()
    .background(Color.theme.background)
}
