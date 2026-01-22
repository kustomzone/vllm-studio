import SwiftUI

/// Individual GPU status card showing utilization, memory, and temperature
struct GPUStatusCard: View {
    let metric: GPUMetric
    let previousMetric: GPUMetric?

    @State private var animatedUtilization: Double = 0
    @State private var animatedMemory: Double = 0

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header with GPU name and index
            headerSection

            // Utilization
            utilizationSection

            // Memory Usage
            memorySection

            // Temperature
            temperatureSection
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
        .onAppear {
            animateValues()
        }
        .onChange(of: metric) { _, _ in
            animateValues()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: .spacing.xxs) {
                Text(metric.name)
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Text("GPU \(metric.index)")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            Spacer()

            // Status indicator
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
        }
    }

    // MARK: - Utilization Section

    private var utilizationSection: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            HStack {
                Text("Utilization")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Spacer()

                HStack(spacing: .spacing.xs) {
                    if let change = utilizationChange {
                        ChangeIndicator(value: change)
                    }

                    Text("\(Int(metric.utilizationPercent))%")
                        .font(.theme.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.theme.foreground)
                }
            }

            AnimatedProgressBar(
                value: animatedUtilization / 100,
                color: utilizationColor
            )
        }
    }

    // MARK: - Memory Section

    private var memorySection: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            HStack {
                Text("Memory")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)

                Spacer()

                HStack(spacing: .spacing.xs) {
                    if let change = memoryChange {
                        ChangeIndicator(value: change)
                    }

                    Text(memoryText)
                        .font(.theme.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.theme.foreground)
                }
            }

            AnimatedProgressBar(
                value: animatedMemory / 100,
                color: memoryColor
            )
        }
    }

    // MARK: - Temperature Section

    private var temperatureSection: some View {
        HStack {
            Image(systemName: "thermometer.medium")
                .font(.system(size: .iconSize.sm))
                .foregroundStyle(temperatureColor)

            Text("Temperature")
                .font(.theme.caption)
                .foregroundStyle(Color.theme.mutedForeground)

            Spacer()

            Text("\(Int(metric.temperatureCelsius))°C")
                .font(.theme.body)
                .fontWeight(.medium)
                .foregroundStyle(temperatureColor)
        }
    }

    // MARK: - Computed Properties

    private var statusColor: Color {
        switch metric.temperatureStatus {
        case .normal:
            return Color.theme.success
        case .warm:
            return Color.theme.warning
        case .hot, .critical:
            return Color.theme.error
        }
    }

    private var utilizationColor: Color {
        switch metric.utilizationPercent {
        case ..<50:
            return Color.theme.success
        case 50..<80:
            return Color.theme.warning
        default:
            return Color.theme.error
        }
    }

    private var memoryColor: Color {
        switch metric.memoryUsagePercent {
        case ..<70:
            return Color.theme.success
        case 70..<90:
            return Color.theme.warning
        default:
            return Color.theme.error
        }
    }

    private var temperatureColor: Color {
        switch metric.temperatureStatus {
        case .normal:
            return Color.theme.success
        case .warm:
            return Color.theme.warning
        case .hot, .critical:
            return Color.theme.error
        }
    }

    private var memoryText: String {
        String(format: "%.1f / %.1f GB", metric.memoryUsedGB, metric.memoryTotalGB)
    }

    private var utilizationChange: Double? {
        guard let previous = previousMetric else { return nil }
        let change = metric.utilizationPercent - previous.utilizationPercent
        return abs(change) > 0.5 ? change : nil
    }

    private var memoryChange: Double? {
        guard let previous = previousMetric else { return nil }
        let change = metric.memoryUsagePercent - previous.memoryUsagePercent
        return abs(change) > 0.5 ? change : nil
    }

    // MARK: - Animation

    private func animateValues() {
        withAnimation(.easeInOut(duration: 0.5)) {
            animatedUtilization = metric.utilizationPercent
            animatedMemory = metric.memoryUsagePercent
        }
    }
}

// MARK: - Animated Progress Bar

/// Progress bar with smooth animation
struct AnimatedProgressBar: View {
    let value: Double
    let color: Color
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background track
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(Color.theme.backgroundSecondary)
                    .frame(height: height)

                // Progress fill
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(color)
                    .frame(width: max(0, geometry.size.width * CGFloat(min(max(value, 0), 1))), height: height)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Change Indicator

/// Shows change direction with arrow and value
struct ChangeIndicator: View {
    let value: Double

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: value > 0 ? "arrow.up" : "arrow.down")
                .font(.system(size: 10, weight: .bold))

            Text(String(format: "%.1f", abs(value)))
                .font(.theme.caption2)
        }
        .foregroundStyle(value > 0 ? Color.theme.error : Color.theme.success)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        GPUStatusCard(
            metric: GPUMetric(
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
            previousMetric: GPUMetric(
                id: "gpu-0",
                name: "NVIDIA RTX 4090",
                index: 0,
                utilizationPercent: 70,
                memoryUsedGB: 17.0,
                memoryTotalGB: 24,
                temperatureCelsius: 62,
                powerWatts: 340,
                powerLimitWatts: 450
            )
        )

        GPUStatusCard(
            metric: GPUMetric(
                id: "gpu-1",
                name: "NVIDIA RTX 4090",
                index: 1,
                utilizationPercent: 95,
                memoryUsedGB: 22.5,
                memoryTotalGB: 24,
                temperatureCelsius: 82,
                powerWatts: 420,
                powerLimitWatts: 450
            ),
            previousMetric: nil
        )
    }
    .padding()
    .background(Color.theme.background)
}
