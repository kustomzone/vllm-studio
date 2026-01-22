import SwiftUI

/// Grid layout for displaying GPU metrics cards
struct MetricsGrid: View {
    let metrics: [GPUMetric]
    let previousMetrics: [String: GPUMetric]

    /// Adaptive columns based on screen size
    private let columns = [
        GridItem(.adaptive(minimum: 300, maximum: 400), spacing: .spacing.lg)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section header
            HStack {
                Image(systemName: "cpu")
                    .font(.system(size: .iconSize.md))
                    .foregroundStyle(Color.theme.primary)

                Text("GPU Status")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Spacer()

                Text("\(metrics.count) GPU\(metrics.count != 1 ? "s" : "")")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            if metrics.isEmpty {
                emptyState
            } else {
                LazyVGrid(columns: columns, spacing: .spacing.lg) {
                    ForEach(metrics) { metric in
                        GPUStatusCard(
                            metric: metric,
                            previousMetric: previousMetrics[metric.id]
                        )
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: .spacing.md) {
            Image(systemName: "cpu.fill")
                .font(.system(size: 40))
                .foregroundStyle(Color.theme.mutedForeground)

            Text("No GPUs Detected")
                .font(.theme.body)
                .foregroundStyle(Color.theme.mutedForeground)

            Text("Connect to a server with GPU support")
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(.spacing.xxl)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Individual Metric Cell

/// Single metric cell for displaying a key-value metric
struct MetricCell: View {
    let icon: String
    let title: String
    let value: String
    let subtitle: String?
    let valueColor: Color

    init(
        icon: String,
        title: String,
        value: String,
        subtitle: String? = nil,
        valueColor: Color = .theme.foreground
    ) {
        self.icon = icon
        self.title = title
        self.value = value
        self.subtitle = subtitle
        self.valueColor = valueColor
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            HStack(spacing: .spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: .iconSize.sm))
                    .foregroundStyle(Color.theme.primary)

                Text(title)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            Text(value)
                .font(.theme.title2)
                .fontWeight(.semibold)
                .foregroundStyle(valueColor)

            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.theme.caption2)
                    .foregroundStyle(Color.theme.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.spacing.md)
        .background(Color.theme.card)
        .cornerRadius(.radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - System Metrics Overview

/// Overview grid showing key system metrics
struct SystemMetricsOverview: View {
    let systemHealth: SystemHealth
    let totalMemoryUsed: Double
    let totalMemoryAvailable: Double

    private let columns = [
        GridItem(.flexible(), spacing: .spacing.md),
        GridItem(.flexible(), spacing: .spacing.md)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: .spacing.md) {
            MetricCell(
                icon: "server.rack",
                title: "Server Status",
                value: systemHealth.status.description,
                subtitle: systemHealth.formattedUptime.map { "Uptime: \($0)" },
                valueColor: statusColor
            )

            MetricCell(
                icon: "memorychip",
                title: "Total VRAM",
                value: String(format: "%.1f GB", totalMemoryUsed),
                subtitle: String(format: "%.1f GB available", totalMemoryAvailable)
            )

            if let modelName = systemHealth.activeModelName {
                MetricCell(
                    icon: "brain",
                    title: "Active Model",
                    value: modelName,
                    subtitle: nil,
                    valueColor: Color.theme.success
                )
            } else {
                MetricCell(
                    icon: "brain",
                    title: "Active Model",
                    value: "None",
                    subtitle: "No model loaded",
                    valueColor: Color.theme.mutedForeground
                )
            }

            MetricCell(
                icon: "cpu",
                title: "GPUs",
                value: "\(systemHealth.healthyGPUs)/\(systemHealth.totalGPUs)",
                subtitle: "Healthy",
                valueColor: systemHealth.healthyGPUs == systemHealth.totalGPUs
                    ? Color.theme.success
                    : Color.theme.warning
            )
        }
    }

    private var statusColor: Color {
        switch systemHealth.status {
        case .healthy:
            return Color.theme.success
        case .degraded:
            return Color.theme.warning
        case .unhealthy:
            return Color.theme.error
        case .unknown:
            return Color.theme.mutedForeground
        }
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 24) {
            MetricsGrid(
                metrics: [
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
                ],
                previousMetrics: [:]
            )

            SystemMetricsOverview(
                systemHealth: SystemHealth(
                    status: .healthy,
                    serverVersion: "1.0.0",
                    uptime: 3600 * 24 + 1800,
                    activeModelId: "model-1",
                    activeModelName: "Llama-3.1-70B",
                    totalGPUs: 2,
                    healthyGPUs: 2,
                    lastChecked: Date()
                ),
                totalMemoryUsed: 30.5,
                totalMemoryAvailable: 17.5
            )

            // Empty state
            MetricsGrid(metrics: [], previousMetrics: [:])
        }
        .padding()
    }
    .background(Color.theme.background)
}
