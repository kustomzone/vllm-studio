//
//  UsageMetrics.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

// MARK: - Usage Stats

/// Overall usage statistics summary
struct UsageStats: Codable, Equatable {
    let totalRequests: Int
    let totalTokens: Int
    let totalPromptTokens: Int
    let totalCompletionTokens: Int
    let totalCost: Double
    let averageLatency: Double
    let averageTokensPerRequest: Double
    let periodStart: Date
    let periodEnd: Date

    /// Previous period stats for comparison
    let previousPeriodRequests: Int?
    let previousPeriodTokens: Int?
    let previousPeriodCost: Double?

    /// Formatted total cost string
    var formattedCost: String {
        String(format: "$%.2f", totalCost)
    }

    /// Formatted total tokens with K/M suffix
    var formattedTokens: String {
        formatLargeNumber(totalTokens)
    }

    /// Formatted total requests with K/M suffix
    var formattedRequests: String {
        formatLargeNumber(totalRequests)
    }

    /// Formatted average latency in milliseconds
    var formattedLatency: String {
        String(format: "%.0fms", averageLatency)
    }

    /// Requests change percentage from previous period
    var requestsChangePercent: Double? {
        guard let previous = previousPeriodRequests, previous > 0 else { return nil }
        return Double(totalRequests - previous) / Double(previous) * 100
    }

    /// Tokens change percentage from previous period
    var tokensChangePercent: Double? {
        guard let previous = previousPeriodTokens, previous > 0 else { return nil }
        return Double(totalTokens - previous) / Double(previous) * 100
    }

    /// Cost change percentage from previous period
    var costChangePercent: Double? {
        guard let previous = previousPeriodCost, previous > 0 else { return nil }
        return (totalCost - previous) / previous * 100
    }

    /// Helper function to format large numbers
    private func formatLargeNumber(_ value: Int) -> String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", Double(value) / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", Double(value) / 1_000)
        } else {
            return "\(value)"
        }
    }

    /// Static empty instance for initial state
    static let empty = UsageStats(
        totalRequests: 0,
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        averageTokensPerRequest: 0,
        periodStart: Date(),
        periodEnd: Date(),
        previousPeriodRequests: nil,
        previousPeriodTokens: nil,
        previousPeriodCost: nil
    )
}

// MARK: - Daily Usage

/// Usage data for a single day
struct DailyUsage: Codable, Identifiable, Equatable {
    let id: String
    let date: Date
    let requests: Int
    let tokens: Int
    let promptTokens: Int
    let completionTokens: Int
    let cost: Double
    let averageLatency: Double

    /// Formatted date string for display
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    /// Short formatted date for chart axis
    var shortDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return formatter.string(from: date)
    }

    /// Formatted cost for display
    var formattedCost: String {
        String(format: "$%.2f", cost)
    }

    /// CodingKeys for JSON decoding
    enum CodingKeys: String, CodingKey {
        case id
        case date
        case requests
        case tokens
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case cost
        case averageLatency = "average_latency"
    }
}

// MARK: - Model Performance

/// Performance metrics for a specific model
struct ModelPerformance: Codable, Identifiable, Equatable {
    let id: String
    let modelId: String
    let modelName: String
    let requests: Int
    let tokens: Int
    let promptTokens: Int
    let completionTokens: Int
    let averageLatency: Double
    let minLatency: Double
    let maxLatency: Double
    let p95Latency: Double
    let errorCount: Int
    let successRate: Double
    let cost: Double

    /// Formatted request count
    var formattedRequests: String {
        if requests >= 1_000 {
            return String(format: "%.1fK", Double(requests) / 1_000)
        }
        return "\(requests)"
    }

    /// Formatted token count
    var formattedTokens: String {
        if tokens >= 1_000_000 {
            return String(format: "%.1fM", Double(tokens) / 1_000_000)
        } else if tokens >= 1_000 {
            return String(format: "%.1fK", Double(tokens) / 1_000)
        }
        return "\(tokens)"
    }

    /// Formatted average latency
    var formattedLatency: String {
        String(format: "%.0fms", averageLatency)
    }

    /// Formatted success rate as percentage
    var formattedSuccessRate: String {
        String(format: "%.1f%%", successRate * 100)
    }

    /// Formatted cost
    var formattedCost: String {
        String(format: "$%.2f", cost)
    }

    /// Short model name for display
    var displayName: String {
        // Extract just the model name without provider prefix if present
        if let lastSlash = modelName.lastIndex(of: "/") {
            return String(modelName[modelName.index(after: lastSlash)...])
        }
        return modelName
    }

    /// CodingKeys for JSON decoding
    enum CodingKeys: String, CodingKey {
        case id
        case modelId = "model_id"
        case modelName = "model_name"
        case requests
        case tokens
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case averageLatency = "average_latency"
        case minLatency = "min_latency"
        case maxLatency = "max_latency"
        case p95Latency = "p95_latency"
        case errorCount = "error_count"
        case successRate = "success_rate"
        case cost
    }
}

// MARK: - Date Range

/// Predefined date ranges for filtering usage data
enum DateRange: String, CaseIterable, Identifiable {
    case week = "7 Days"
    case twoWeeks = "14 Days"
    case month = "30 Days"
    case quarter = "90 Days"
    case year = "365 Days"

    var id: String { rawValue }

    /// Number of days in the range
    var days: Int {
        switch self {
        case .week: return 7
        case .twoWeeks: return 14
        case .month: return 30
        case .quarter: return 90
        case .year: return 365
        }
    }

    /// Start date for the range
    var startDate: Date {
        Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
    }

    /// End date for the range (today)
    var endDate: Date {
        Date()
    }

    /// Short label for compact display
    var shortLabel: String {
        switch self {
        case .week: return "7D"
        case .twoWeeks: return "14D"
        case .month: return "30D"
        case .quarter: return "90D"
        case .year: return "1Y"
        }
    }

    /// Icon name for the date range
    var iconName: String {
        switch self {
        case .week: return "calendar.badge.clock"
        case .twoWeeks: return "calendar"
        case .month: return "calendar"
        case .quarter: return "calendar.badge.plus"
        case .year: return "calendar.circle"
        }
    }
}

// MARK: - Peak Usage

/// Peak usage metrics
struct PeakUsage: Codable, Equatable {
    let peakRequestsPerMinute: Int
    let peakTokensPerMinute: Int
    let peakConcurrentRequests: Int
    let peakTimestamp: Date
    let peakDay: Date?

    /// Formatted peak requests
    var formattedPeakRequests: String {
        "\(peakRequestsPerMinute)/min"
    }

    /// Formatted peak tokens
    var formattedPeakTokens: String {
        if peakTokensPerMinute >= 1_000 {
            return String(format: "%.1fK/min", Double(peakTokensPerMinute) / 1_000)
        }
        return "\(peakTokensPerMinute)/min"
    }

    /// Formatted peak timestamp
    var formattedPeakTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, h:mm a"
        return formatter.string(from: peakTimestamp)
    }

    /// CodingKeys for JSON decoding
    enum CodingKeys: String, CodingKey {
        case peakRequestsPerMinute = "peak_requests_per_minute"
        case peakTokensPerMinute = "peak_tokens_per_minute"
        case peakConcurrentRequests = "peak_concurrent_requests"
        case peakTimestamp = "peak_timestamp"
        case peakDay = "peak_day"
    }

    /// Static empty instance
    static let empty = PeakUsage(
        peakRequestsPerMinute: 0,
        peakTokensPerMinute: 0,
        peakConcurrentRequests: 0,
        peakTimestamp: Date(),
        peakDay: nil
    )
}

// MARK: - Usage Response

/// Combined usage response from API
struct UsageResponse: Codable {
    let stats: UsageStats
    let dailyUsage: [DailyUsage]
    let modelPerformance: [ModelPerformance]
    let peakUsage: PeakUsage?

    enum CodingKeys: String, CodingKey {
        case stats
        case dailyUsage = "daily_usage"
        case modelPerformance = "model_performance"
        case peakUsage = "peak_usage"
    }
}

// MARK: - Sort Options

/// Sort options for model performance table
enum ModelPerformanceSortOption: String, CaseIterable, Identifiable {
    case requests = "Requests"
    case tokens = "Tokens"
    case latency = "Latency"
    case cost = "Cost"
    case successRate = "Success Rate"

    var id: String { rawValue }

    /// System image for the sort option
    var iconName: String {
        switch self {
        case .requests: return "number"
        case .tokens: return "text.word.spacing"
        case .latency: return "clock"
        case .cost: return "dollarsign.circle"
        case .successRate: return "checkmark.circle"
        }
    }
}

/// Sort direction
enum SortDirection {
    case ascending
    case descending

    var toggled: SortDirection {
        self == .ascending ? .descending : .ascending
    }

    var iconName: String {
        self == .ascending ? "chevron.up" : "chevron.down"
    }
}

// MARK: - Chart Data Point

/// Data point for usage charts
struct UsageChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
    let series: ChartSeries

    enum ChartSeries: String {
        case requests = "Requests"
        case tokens = "Tokens"

        var color: String {
            switch self {
            case .requests: return "#d97706" // Primary/orange
            case .tokens: return "#2563eb" // Info/blue
            }
        }
    }
}
