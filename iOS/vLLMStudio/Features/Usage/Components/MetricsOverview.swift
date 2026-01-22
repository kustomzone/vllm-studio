//
//  MetricsOverview.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Summary cards displaying key usage metrics in a 2x2 grid
struct MetricsOverview: View {

    // MARK: - Properties

    let stats: UsageStats
    let peakUsage: PeakUsage

    // MARK: - Body

    var body: some View {
        VStack(spacing: .spacing.md) {
            // First row: Requests and Tokens
            HStack(spacing: .spacing.md) {
                MetricCard(
                    title: "Total Requests",
                    value: stats.formattedRequests,
                    subtitle: "requests made",
                    iconName: "arrow.up.arrow.down",
                    iconColor: Color.theme.primary,
                    change: requestsChange
                )

                MetricCard(
                    title: "Total Tokens",
                    value: stats.formattedTokens,
                    subtitle: "tokens processed",
                    iconName: "text.word.spacing",
                    iconColor: Color.theme.info,
                    change: tokensChange
                )
            }

            // Second row: Cost and Peak Usage
            HStack(spacing: .spacing.md) {
                MetricCard(
                    title: "Total Cost",
                    value: stats.formattedCost,
                    subtitle: "for the period",
                    iconName: "dollarsign.circle",
                    iconColor: Color.theme.success,
                    change: costChange
                )

                MetricCard(
                    title: "Peak Usage",
                    value: peakUsage.formattedPeakRequests,
                    subtitle: peakUsage.formattedPeakTime,
                    iconName: "chart.line.uptrend.xyaxis",
                    iconColor: Color.theme.warning,
                    change: nil
                )
            }
        }
    }

    // MARK: - Change Calculations

    private var requestsChange: ChangeIndicator.Change? {
        guard let percent = stats.requestsChangePercent else { return nil }
        if percent > 0 {
            return .increase(
                value: Double(stats.totalRequests - (stats.previousPeriodRequests ?? 0)),
                percentage: percent
            )
        } else if percent < 0 {
            return .decrease(
                value: Double((stats.previousPeriodRequests ?? 0) - stats.totalRequests),
                percentage: abs(percent)
            )
        }
        return .unchanged
    }

    private var tokensChange: ChangeIndicator.Change? {
        guard let percent = stats.tokensChangePercent else { return nil }
        if percent > 0 {
            return .increase(
                value: Double(stats.totalTokens - (stats.previousPeriodTokens ?? 0)),
                percentage: percent
            )
        } else if percent < 0 {
            return .decrease(
                value: Double((stats.previousPeriodTokens ?? 0) - stats.totalTokens),
                percentage: abs(percent)
            )
        }
        return .unchanged
    }

    private var costChange: ChangeIndicator.Change? {
        guard let percent = stats.costChangePercent else { return nil }
        if percent > 0 {
            return .increase(
                value: stats.totalCost - (stats.previousPeriodCost ?? 0),
                percentage: percent
            )
        } else if percent < 0 {
            return .decrease(
                value: (stats.previousPeriodCost ?? 0) - stats.totalCost,
                percentage: abs(percent)
            )
        }
        return .unchanged
    }
}

// MARK: - Metric Card

/// Individual metric card with icon, value, and optional change indicator
struct MetricCard: View {

    let title: String
    let value: String
    let subtitle: String
    let iconName: String
    let iconColor: Color
    let change: ChangeIndicator.Change?

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header with icon
            HStack(spacing: .spacing.sm) {
                Image(systemName: iconName)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(iconColor)

                Text(title)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)

                Spacer()
            }

            // Value
            HStack(alignment: .firstTextBaseline, spacing: .spacing.sm) {
                Text(value)
                    .font(.theme.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                if let change = change {
                    InlineChangeIndicator(change: change)
                }
            }

            // Subtitle
            Text(subtitle)
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.spacing.md)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Compact Metric Card

/// A more compact version of the metric card for smaller displays
struct CompactMetricCard: View {

    let title: String
    let value: String
    let iconName: String
    let iconColor: Color

    var body: some View {
        HStack(spacing: .spacing.md) {
            // Icon
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 36, height: 36)

                Image(systemName: iconName)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(iconColor)
            }

            // Text
            VStack(alignment: .leading, spacing: .spacing.xxs) {
                Text(title)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)

                Text(value)
                    .font(.theme.body)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.foreground)
            }

            Spacer()
        }
        .padding(.spacing.md)
        .background(Color.theme.card)
        .cornerRadius(.radius.md)
    }
}

// MARK: - Detailed Stats Card

/// A larger card showing detailed statistics with breakdown
struct DetailedStatsCard: View {

    let stats: UsageStats

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.lg) {
            // Header
            Text("Token Breakdown")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            // Token breakdown
            VStack(spacing: .spacing.md) {
                StatRow(
                    label: "Prompt Tokens",
                    value: formatNumber(stats.totalPromptTokens),
                    color: Color.theme.info
                )

                StatRow(
                    label: "Completion Tokens",
                    value: formatNumber(stats.totalCompletionTokens),
                    color: Color.theme.success
                )

                Divider()
                    .background(Color.theme.border)

                StatRow(
                    label: "Total Tokens",
                    value: formatNumber(stats.totalTokens),
                    color: Color.theme.foreground,
                    isBold: true
                )
            }

            // Additional metrics
            VStack(spacing: .spacing.sm) {
                HStack {
                    Text("Avg. Latency")
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                    Spacer()
                    Text(stats.formattedLatency)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.foreground)
                }

                HStack {
                    Text("Avg. Tokens/Request")
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                    Spacer()
                    Text(String(format: "%.1f", stats.averageTokensPerRequest))
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.foreground)
                }
            }
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private func formatNumber(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

// MARK: - Stat Row

/// A row showing a label and value pair
private struct StatRow: View {

    let label: String
    let value: String
    let color: Color
    var isBold: Bool = false

    var body: some View {
        HStack {
            HStack(spacing: .spacing.sm) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)

                Text(label)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            Spacer()

            Text(value)
                .font(.theme.body)
                .fontWeight(isBold ? .semibold : .regular)
                .foregroundColor(color)
        }
    }
}

// MARK: - Previews

#Preview("Metrics Overview") {
    let stats = UsageStats(
        totalRequests: 12456,
        totalTokens: 2345678,
        totalPromptTokens: 1234567,
        totalCompletionTokens: 1111111,
        totalCost: 45.67,
        averageLatency: 234.5,
        averageTokensPerRequest: 188.3,
        periodStart: Calendar.current.date(byAdding: .day, value: -7, to: Date())!,
        periodEnd: Date(),
        previousPeriodRequests: 10500,
        previousPeriodTokens: 2100000,
        previousPeriodCost: 38.50
    )

    let peakUsage = PeakUsage(
        peakRequestsPerMinute: 156,
        peakTokensPerMinute: 45678,
        peakConcurrentRequests: 12,
        peakTimestamp: Calendar.current.date(byAdding: .hour, value: -14, to: Date())!,
        peakDay: nil
    )

    return ScrollView {
        MetricsOverview(stats: stats, peakUsage: peakUsage)
            .padding()
    }
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Metric Card") {
    HStack(spacing: .spacing.md) {
        MetricCard(
            title: "Total Requests",
            value: "12.5K",
            subtitle: "requests made",
            iconName: "arrow.up.arrow.down",
            iconColor: Color.theme.primary,
            change: .increase(value: 1500, percentage: 12.5)
        )

        MetricCard(
            title: "Total Cost",
            value: "$45.67",
            subtitle: "for the period",
            iconName: "dollarsign.circle",
            iconColor: Color.theme.success,
            change: .decrease(value: 5.0, percentage: 8.3)
        )
    }
    .padding()
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Detailed Stats Card") {
    let stats = UsageStats(
        totalRequests: 12456,
        totalTokens: 2345678,
        totalPromptTokens: 1234567,
        totalCompletionTokens: 1111111,
        totalCost: 45.67,
        averageLatency: 234.5,
        averageTokensPerRequest: 188.3,
        periodStart: Calendar.current.date(byAdding: .day, value: -7, to: Date())!,
        periodEnd: Date(),
        previousPeriodRequests: nil,
        previousPeriodTokens: nil,
        previousPeriodCost: nil
    )

    return DetailedStatsCard(stats: stats)
        .padding()
        .background(Color.theme.background)
        .preferredColorScheme(.dark)
}
