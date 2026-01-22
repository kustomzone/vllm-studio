//
//  ModelPerformanceTable.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Table displaying model performance metrics with sortable columns and expandable rows
struct ModelPerformanceTable: View {

    // MARK: - Properties

    let models: [ModelPerformance]
    let sortOption: ModelPerformanceSortOption
    let sortDirection: SortDirection
    let expandedModelIds: Set<String>
    let onSort: (ModelPerformanceSortOption) -> Void
    let onToggleExpand: (String) -> Void

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header
            header

            // Table content
            VStack(spacing: 0) {
                // Column headers
                columnHeaders

                Divider()
                    .background(Color.theme.border)

                // Rows
                ForEach(models) { model in
                    VStack(spacing: 0) {
                        modelRow(model)

                        // Expanded details
                        if expandedModelIds.contains(model.id) {
                            expandedDetails(model)
                        }

                        if model.id != models.last?.id {
                            Divider()
                                .background(Color.theme.border)
                        }
                    }
                }
            }
            .background(Color.theme.backgroundSecondary)
            .cornerRadius(.radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: .spacing.xs) {
                Text("Model Performance")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text("\(models.count) model\(models.count == 1 ? "" : "s") used")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            Spacer()

            // Sort indicator
            HStack(spacing: .spacing.xs) {
                Text("Sort by:")
                    .font(.theme.caption2)
                    .foregroundColor(Color.theme.mutedForeground)

                Menu {
                    ForEach(ModelPerformanceSortOption.allCases) { option in
                        Button {
                            onSort(option)
                        } label: {
                            HStack {
                                Text(option.rawValue)
                                if sortOption == option {
                                    Image(systemName: sortDirection.iconName)
                                }
                            }
                        }
                    }
                } label: {
                    HStack(spacing: .spacing.xs) {
                        Text(sortOption.rawValue)
                            .font(.theme.caption)
                            .foregroundColor(Color.theme.primary)

                        Image(systemName: sortDirection.iconName)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(Color.theme.primary)
                    }
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xs)
                    .background(Color.theme.primary.opacity(0.1))
                    .cornerRadius(.radius.sm)
                }
            }
        }
    }

    // MARK: - Column Headers

    private var columnHeaders: some View {
        HStack(spacing: 0) {
            // Model name column
            Text("Model")
                .font(.theme.caption)
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.mutedForeground)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Requests column
            sortableColumnHeader(.requests, label: "Requests", width: 70)

            // Tokens column
            sortableColumnHeader(.tokens, label: "Tokens", width: 70)

            // Latency column
            sortableColumnHeader(.latency, label: "Latency", width: 70)

            // Expand indicator
            Color.clear
                .frame(width: 30)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color.theme.backgroundTertiary)
    }

    private func sortableColumnHeader(
        _ option: ModelPerformanceSortOption,
        label: String,
        width: CGFloat
    ) -> some View {
        Button {
            onSort(option)
        } label: {
            HStack(spacing: .spacing.xxs) {
                Text(label)
                    .font(.theme.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(
                        sortOption == option
                        ? Color.theme.primary
                        : Color.theme.mutedForeground
                    )

                if sortOption == option {
                    Image(systemName: sortDirection.iconName)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(Color.theme.primary)
                }
            }
        }
        .frame(width: width, alignment: .trailing)
    }

    // MARK: - Model Row

    private func modelRow(_ model: ModelPerformance) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                onToggleExpand(model.id)
            }
        } label: {
            HStack(spacing: 0) {
                // Model name
                VStack(alignment: .leading, spacing: .spacing.xxs) {
                    Text(model.displayName)
                        .font(.theme.body)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.foreground)
                        .lineLimit(1)

                    Text(model.modelId)
                        .font(.theme.caption2)
                        .foregroundColor(Color.theme.mutedForeground)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Requests
                Text(model.formattedRequests)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.foreground)
                    .frame(width: 70, alignment: .trailing)

                // Tokens
                Text(model.formattedTokens)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.foreground)
                    .frame(width: 70, alignment: .trailing)

                // Latency
                Text(model.formattedLatency)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.foreground)
                    .frame(width: 70, alignment: .trailing)

                // Expand indicator
                Image(systemName: expandedModelIds.contains(model.id) ? "chevron.up" : "chevron.down")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.theme.mutedForeground)
                    .frame(width: 30)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.md)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Expanded Details

    private func expandedDetails(_ model: ModelPerformance) -> some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Divider
            Rectangle()
                .fill(Color.theme.border)
                .frame(height: 1)
                .padding(.horizontal, .spacing.md)

            // Stats grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: .spacing.md) {
                detailStat(label: "Prompt Tokens", value: formatNumber(model.promptTokens))
                detailStat(label: "Completion Tokens", value: formatNumber(model.completionTokens))
                detailStat(label: "Total Cost", value: model.formattedCost)
                detailStat(label: "Min Latency", value: String(format: "%.0fms", model.minLatency))
                detailStat(label: "P95 Latency", value: String(format: "%.0fms", model.p95Latency))
                detailStat(label: "Max Latency", value: String(format: "%.0fms", model.maxLatency))
                detailStat(label: "Success Rate", value: model.formattedSuccessRate, color: successRateColor(model.successRate))
                detailStat(label: "Errors", value: "\(model.errorCount)", color: model.errorCount > 0 ? Color.theme.error : nil)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.bottom, .spacing.md)
        }
        .background(Color.theme.background.opacity(0.5))
    }

    private func detailStat(label: String, value: String, color: Color? = nil) -> some View {
        VStack(alignment: .leading, spacing: .spacing.xxs) {
            Text(label)
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)

            Text(value)
                .font(.theme.caption)
                .fontWeight(.medium)
                .foregroundColor(color ?? Color.theme.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Helpers

    private func formatNumber(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", Double(value) / 1_000)
        }
        return "\(value)"
    }

    private func successRateColor(_ rate: Double) -> Color {
        if rate >= 0.99 {
            return Color.theme.success
        } else if rate >= 0.95 {
            return Color.theme.warning
        } else {
            return Color.theme.error
        }
    }
}

// MARK: - Compact Model Performance List

/// A more compact list view for smaller screens
struct CompactModelPerformanceList: View {

    let models: [ModelPerformance]

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            Text("Model Performance")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            ForEach(models) { model in
                compactModelCard(model)
            }
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
    }

    private func compactModelCard(_ model: ModelPerformance) -> some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            // Model name
            Text(model.displayName)
                .font(.theme.body)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.foreground)

            // Stats row
            HStack(spacing: .spacing.lg) {
                statItem(icon: "number", value: model.formattedRequests, label: "requests")
                statItem(icon: "text.word.spacing", value: model.formattedTokens, label: "tokens")
                statItem(icon: "clock", value: model.formattedLatency, label: "avg")
            }
        }
        .padding(.spacing.md)
        .background(Color.theme.backgroundSecondary)
        .cornerRadius(.radius.md)
    }

    private func statItem(icon: String, value: String, label: String) -> some View {
        HStack(spacing: .spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10))
                .foregroundColor(Color.theme.mutedForeground)

            Text(value)
                .font(.theme.caption)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.foreground)

            Text(label)
                .font(.theme.caption2)
                .foregroundColor(Color.theme.mutedForeground)
        }
    }
}

// MARK: - Previews

#Preview("Model Performance Table") {
    let models = [
        ModelPerformance(
            id: "1",
            modelId: "llama-3.1-70b",
            modelName: "meta-llama/Llama-3.1-70B-Instruct",
            requests: 8234,
            tokens: 1567890,
            promptTokens: 890123,
            completionTokens: 677767,
            averageLatency: 245.6,
            minLatency: 89.2,
            maxLatency: 1234.5,
            p95Latency: 567.8,
            errorCount: 12,
            successRate: 0.9985,
            cost: 32.45
        ),
        ModelPerformance(
            id: "2",
            modelId: "mistral-7b",
            modelName: "mistralai/Mistral-7B-Instruct-v0.3",
            requests: 3456,
            tokens: 678901,
            promptTokens: 345678,
            completionTokens: 333223,
            averageLatency: 156.7,
            minLatency: 45.3,
            maxLatency: 678.9,
            p95Latency: 312.4,
            errorCount: 5,
            successRate: 0.9986,
            cost: 10.23
        ),
        ModelPerformance(
            id: "3",
            modelId: "qwen-2.5-72b",
            modelName: "Qwen/Qwen2.5-72B-Instruct",
            requests: 766,
            tokens: 98887,
            promptTokens: 54321,
            completionTokens: 44566,
            averageLatency: 312.4,
            minLatency: 123.4,
            maxLatency: 987.6,
            p95Latency: 654.3,
            errorCount: 2,
            successRate: 0.9974,
            cost: 2.99
        )
    ]

    return ScrollView {
        ModelPerformanceTable(
            models: models,
            sortOption: .requests,
            sortDirection: .descending,
            expandedModelIds: ["1"],
            onSort: { _ in },
            onToggleExpand: { _ in }
        )
        .padding()
    }
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Compact Model List") {
    let models = [
        ModelPerformance(
            id: "1",
            modelId: "llama-3.1-70b",
            modelName: "meta-llama/Llama-3.1-70B-Instruct",
            requests: 8234,
            tokens: 1567890,
            promptTokens: 890123,
            completionTokens: 677767,
            averageLatency: 245.6,
            minLatency: 89.2,
            maxLatency: 1234.5,
            p95Latency: 567.8,
            errorCount: 12,
            successRate: 0.9985,
            cost: 32.45
        ),
        ModelPerformance(
            id: "2",
            modelId: "mistral-7b",
            modelName: "mistralai/Mistral-7B-Instruct-v0.3",
            requests: 3456,
            tokens: 678901,
            promptTokens: 345678,
            completionTokens: 333223,
            averageLatency: 156.7,
            minLatency: 45.3,
            maxLatency: 678.9,
            p95Latency: 312.4,
            errorCount: 5,
            successRate: 0.9986,
            cost: 10.23
        )
    ]

    return ScrollView {
        CompactModelPerformanceList(models: models)
            .padding()
    }
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}
