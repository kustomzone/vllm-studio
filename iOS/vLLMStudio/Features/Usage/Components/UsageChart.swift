//
//  UsageChart.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI
import Charts

/// Line chart displaying daily usage over time with tokens and requests
struct UsageChart: View {

    // MARK: - Properties

    let dailyUsage: [DailyUsage]
    let selectedDateRange: DateRange

    // MARK: - State

    @State private var selectedElement: DailyUsage?
    @State private var selectedDate: Date?
    @State private var showTokens: Bool = true
    @State private var showRequests: Bool = true

    // MARK: - Computed Properties

    private var maxTokens: Int {
        dailyUsage.map { $0.tokens }.max() ?? 1
    }

    private var maxRequests: Int {
        dailyUsage.map { $0.requests }.max() ?? 1
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header
            header

            // Chart
            chartContent
                .frame(height: 220)

            // Legend
            legend
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
                Text("Usage Over Time")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text("\(selectedDateRange.rawValue) overview")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            Spacer()

            // Toggle buttons
            HStack(spacing: .spacing.sm) {
                chartToggleButton(
                    title: "Tokens",
                    isEnabled: showTokens,
                    color: Color.theme.info
                ) {
                    showTokens.toggle()
                }

                chartToggleButton(
                    title: "Requests",
                    isEnabled: showRequests,
                    color: Color.theme.primary
                ) {
                    showRequests.toggle()
                }
            }
        }
    }

    private func chartToggleButton(
        title: String,
        isEnabled: Bool,
        color: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: .spacing.xs) {
                Circle()
                    .fill(isEnabled ? color : Color.theme.mutedForeground.opacity(0.5))
                    .frame(width: 8, height: 8)

                Text(title)
                    .font(.theme.caption2)
                    .foregroundColor(isEnabled ? Color.theme.foreground : Color.theme.mutedForeground)
            }
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color.theme.backgroundSecondary)
            .cornerRadius(.radius.sm)
        }
    }

    // MARK: - Chart Content

    private var chartContent: some View {
        Chart {
            // Tokens line
            if showTokens {
                ForEach(dailyUsage) { usage in
                    LineMark(
                        x: .value("Date", usage.date, unit: .day),
                        y: .value("Tokens", usage.tokens),
                        series: .value("Series", "Tokens")
                    )
                    .foregroundStyle(Color.theme.info)
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2))

                    AreaMark(
                        x: .value("Date", usage.date, unit: .day),
                        y: .value("Tokens", usage.tokens),
                        series: .value("Series", "Tokens")
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color.theme.info.opacity(0.3),
                                Color.theme.info.opacity(0.0)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.catmullRom)
                }
            }

            // Requests line (on secondary axis)
            if showRequests {
                ForEach(dailyUsage) { usage in
                    LineMark(
                        x: .value("Date", usage.date, unit: .day),
                        y: .value("Requests", usage.requests),
                        series: .value("Series", "Requests")
                    )
                    .foregroundStyle(Color.theme.primary)
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2))

                    PointMark(
                        x: .value("Date", usage.date, unit: .day),
                        y: .value("Requests", usage.requests)
                    )
                    .foregroundStyle(Color.theme.primary)
                    .symbolSize(30)
                }
            }

            // Selection indicator
            if let selectedDate = selectedDate,
               let selected = dailyUsage.first(where: { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }) {
                RuleMark(x: .value("Selected", selected.date, unit: .day))
                    .foregroundStyle(Color.theme.mutedForeground.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 5]))
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: xAxisStride)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.theme.border)
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(formatAxisDate(date))
                            .font(.theme.caption2)
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Color.theme.border)
                AxisValueLabel {
                    if let intValue = value.as(Int.self) {
                        Text(formatYAxisValue(intValue))
                            .font(.theme.caption2)
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }
        }
        .chartYScale(domain: 0...(showTokens ? maxTokens : maxRequests))
        .chartOverlay { proxy in
            GeometryReader { geometry in
                Rectangle()
                    .fill(.clear)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let location = value.location
                                if let date: Date = proxy.value(atX: location.x) {
                                    selectedDate = date
                                    selectedElement = dailyUsage.first { usage in
                                        Calendar.current.isDate(usage.date, inSameDayAs: date)
                                    }
                                }
                            }
                            .onEnded { _ in
                                // Keep selection visible briefly
                                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                    withAnimation {
                                        selectedDate = nil
                                        selectedElement = nil
                                    }
                                }
                            }
                    )
            }
        }
        .chartBackground { _ in
            Color.clear
        }
        // Tooltip overlay
        .overlay(alignment: .top) {
            if let selected = selectedElement {
                tooltip(for: selected)
                    .transition(.opacity)
            }
        }
    }

    // MARK: - Tooltip

    private func tooltip(for usage: DailyUsage) -> some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            Text(usage.formattedDate)
                .font(.theme.caption)
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.foreground)

            HStack(spacing: .spacing.md) {
                if showTokens {
                    HStack(spacing: .spacing.xs) {
                        Circle()
                            .fill(Color.theme.info)
                            .frame(width: 6, height: 6)
                        Text(formatNumber(usage.tokens))
                            .font(.theme.caption2)
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }

                if showRequests {
                    HStack(spacing: .spacing.xs) {
                        Circle()
                            .fill(Color.theme.primary)
                            .frame(width: 6, height: 6)
                        Text("\(usage.requests)")
                            .font(.theme.caption2)
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }
        }
        .padding(.spacing.sm)
        .background(Color.theme.backgroundSecondary)
        .cornerRadius(.radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.sm)
                .stroke(Color.theme.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
    }

    // MARK: - Legend

    private var legend: some View {
        HStack(spacing: .spacing.lg) {
            if showTokens {
                LegendItem(
                    color: Color.theme.info,
                    label: "Tokens",
                    value: formatNumber(dailyUsage.map { $0.tokens }.reduce(0, +))
                )
            }

            if showRequests {
                LegendItem(
                    color: Color.theme.primary,
                    label: "Requests",
                    value: "\(dailyUsage.map { $0.requests }.reduce(0, +))"
                )
            }

            Spacer()

            // Cost for period
            VStack(alignment: .trailing, spacing: .spacing.xxs) {
                Text("Period Cost")
                    .font(.theme.caption2)
                    .foregroundColor(Color.theme.mutedForeground)
                Text(String(format: "$%.2f", dailyUsage.map { $0.cost }.reduce(0, +)))
                    .font(.theme.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.success)
            }
        }
    }

    // MARK: - Helpers

    private var xAxisStride: Calendar.Component {
        switch selectedDateRange {
        case .week: return .day
        case .twoWeeks: return .day
        case .month: return .weekOfYear
        case .quarter: return .month
        case .year: return .month
        }
    }

    private func formatAxisDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        switch selectedDateRange {
        case .week, .twoWeeks:
            formatter.dateFormat = "M/d"
        case .month:
            formatter.dateFormat = "M/d"
        case .quarter, .year:
            formatter.dateFormat = "MMM"
        }
        return formatter.string(from: date)
    }

    private func formatYAxisValue(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.0fK", Double(value) / 1_000)
        }
        return "\(value)"
    }

    private func formatNumber(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", Double(value) / 1_000)
        }
        return "\(value)"
    }
}

// MARK: - Legend Item

private struct LegendItem: View {
    let color: Color
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: .spacing.sm) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 12, height: 3)

            VStack(alignment: .leading, spacing: .spacing.xxs) {
                Text(label)
                    .font(.theme.caption2)
                    .foregroundColor(Color.theme.mutedForeground)
                Text(value)
                    .font(.theme.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.foreground)
            }
        }
    }
}

// MARK: - Previews

#Preview("Usage Chart") {
    let calendar = Calendar.current
    let dailyUsage = (0..<7).map { daysAgo in
        let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date())!
        return DailyUsage(
            id: UUID().uuidString,
            date: date,
            requests: Int.random(in: 1500...2000),
            tokens: Int.random(in: 300000...400000),
            promptTokens: Int.random(in: 150000...200000),
            completionTokens: Int.random(in: 150000...200000),
            cost: Double.random(in: 5.0...8.0),
            averageLatency: Double.random(in: 180...280)
        )
    }.reversed()

    return ScrollView {
        UsageChart(
            dailyUsage: Array(dailyUsage),
            selectedDateRange: .week
        )
        .padding()
    }
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Usage Chart - Month") {
    let calendar = Calendar.current
    let dailyUsage = (0..<30).map { daysAgo in
        let date = calendar.date(byAdding: .day, value: -daysAgo, to: Date())!
        return DailyUsage(
            id: UUID().uuidString,
            date: date,
            requests: Int.random(in: 1200...2200),
            tokens: Int.random(in: 250000...450000),
            promptTokens: Int.random(in: 125000...225000),
            completionTokens: Int.random(in: 125000...225000),
            cost: Double.random(in: 4.0...9.0),
            averageLatency: Double.random(in: 150...300)
        )
    }.reversed()

    return ScrollView {
        UsageChart(
            dailyUsage: Array(dailyUsage),
            selectedDateRange: .month
        )
        .padding()
    }
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}
