//
//  LogFilterBar.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Filter bar for log viewing with search and level filtering
struct LogFilterBar: View {
    /// Current search text
    @Binding var filterText: String

    /// Current level filter
    @Binding var levelFilter: LogFilter

    /// Whether to show the clear button
    var showClearButton: Bool {
        !filterText.isEmpty || levelFilter != .all
    }

    /// Action when clear is tapped
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: .spacing.md) {
            // Search field
            searchField

            // Level filter picker
            levelFilterPicker

            // Clear button
            if showClearButton {
                clearButton
            }
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
    }

    // MARK: - Search Field

    private var searchField: some View {
        HStack(spacing: .spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundColor(Color.theme.mutedForeground)

            TextField("Search logs...", text: $filterText)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            if !filterText.isEmpty {
                Button {
                    filterText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color.theme.backgroundTertiary)
        .cornerRadius(.radius.md)
    }

    // MARK: - Level Filter Picker

    private var levelFilterPicker: some View {
        Menu {
            ForEach(LogFilter.allCases) { filter in
                Button {
                    levelFilter = filter
                } label: {
                    Label {
                        Text(filter.rawValue)
                    } icon: {
                        Image(systemName: filter.iconName)
                    }
                }
            }
        } label: {
            HStack(spacing: .spacing.sm) {
                Image(systemName: levelFilter.iconName)
                    .font(.system(size: 12))

                Text(levelFilter.rawValue)
                    .font(.theme.caption)
                    .fontWeight(.medium)

                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundColor(levelFilter == .all ? Color.theme.foreground : filterColor)
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(
                levelFilter == .all
                    ? Color.theme.backgroundTertiary
                    : filterColor.opacity(0.15)
            )
            .cornerRadius(.radius.md)
        }
    }

    // MARK: - Clear Button

    private var clearButton: some View {
        Button {
            onClear()
        } label: {
            Text("Clear")
                .font(.theme.caption)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.primary)
                .padding(.horizontal, .spacing.md)
                .padding(.vertical, .spacing.sm)
                .background(Color.theme.primary.opacity(0.1))
                .cornerRadius(.radius.md)
        }
    }

    // MARK: - Filter Color

    private var filterColor: Color {
        switch levelFilter {
        case .all:
            return Color.theme.foreground
        case .error:
            return Color.theme.error
        case .warning:
            return Color.theme.warning
        case .info:
            return Color.theme.info
        case .debug:
            return Color.theme.mutedForeground
        }
    }
}

// MARK: - Compact Filter Bar

/// A more compact filter bar for smaller screens
struct CompactLogFilterBar: View {
    @Binding var filterText: String
    @Binding var levelFilter: LogFilter
    let onClear: () -> Void

    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(spacing: 0) {
            // Main bar
            HStack(spacing: .spacing.md) {
                // Search field
                searchField

                // Expand button
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isExpanded.toggle()
                    }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 16))
                        .foregroundColor(
                            levelFilter != .all
                                ? Color.theme.primary
                                : Color.theme.foreground
                        )
                        .frame(width: 36, height: 36)
                        .background(Color.theme.backgroundTertiary)
                        .cornerRadius(.radius.md)
                }
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.md)

            // Expanded filter options
            if isExpanded {
                filterOptions
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .background(Color.theme.backgroundSecondary)
    }

    private var searchField: some View {
        HStack(spacing: .spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundColor(Color.theme.mutedForeground)

            TextField("Search logs...", text: $filterText)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            if !filterText.isEmpty {
                Button {
                    filterText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color.theme.backgroundTertiary)
        .cornerRadius(.radius.md)
    }

    private var filterOptions: some View {
        VStack(spacing: .spacing.sm) {
            // Level filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .spacing.sm) {
                    ForEach(LogFilter.allCases) { filter in
                        FilterChip(
                            filter: filter,
                            isSelected: levelFilter == filter,
                            onTap: {
                                levelFilter = filter
                            }
                        )
                    }
                }
                .padding(.horizontal, .spacing.lg)
            }

            // Clear button
            if !filterText.isEmpty || levelFilter != .all {
                Button {
                    onClear()
                } label: {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: "xmark.circle")
                            .font(.system(size: 12))

                        Text("Clear Filters")
                            .font(.theme.caption)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(Color.theme.primary)
                }
                .padding(.bottom, .spacing.sm)
            }
        }
        .padding(.vertical, .spacing.sm)
    }
}

// MARK: - Filter Chip

/// A chip-style button for filter selection
struct FilterChip: View {
    let filter: LogFilter
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: filter.iconName)
                    .font(.system(size: 12))

                Text(filter.rawValue)
                    .font(.theme.caption)
                    .fontWeight(isSelected ? .semibold : .regular)
            }
            .foregroundColor(isSelected ? chipColor : Color.theme.foreground)
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(
                isSelected
                    ? chipColor.opacity(0.15)
                    : Color.theme.backgroundTertiary
            )
            .cornerRadius(.radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(
                        isSelected ? chipColor.opacity(0.5) : Color.clear,
                        lineWidth: 1
                    )
            )
        }
    }

    private var chipColor: Color {
        switch filter {
        case .all:
            return Color.theme.primary
        case .error:
            return Color.theme.error
        case .warning:
            return Color.theme.warning
        case .info:
            return Color.theme.info
        case .debug:
            return Color.theme.mutedForeground
        }
    }
}

// MARK: - Filter Summary

/// Shows a summary of active filters
struct FilterSummary: View {
    let filterText: String
    let levelFilter: LogFilter
    let resultCount: Int
    let onClearSearch: () -> Void
    let onClearLevel: () -> Void

    var hasFilters: Bool {
        !filterText.isEmpty || levelFilter != .all
    }

    var body: some View {
        if hasFilters {
            HStack(spacing: .spacing.sm) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.system(size: 12))
                    .foregroundColor(Color.theme.mutedForeground)

                Text("\(resultCount) results")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)

                if !filterText.isEmpty {
                    filterTag(
                        text: "\"\(filterText)\"",
                        onRemove: onClearSearch
                    )
                }

                if levelFilter != .all {
                    filterTag(
                        text: levelFilter.rawValue,
                        color: levelColor,
                        onRemove: onClearLevel
                    )
                }

                Spacer()
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.backgroundSecondary.opacity(0.5))
        }
    }

    private func filterTag(
        text: String,
        color: Color = Color.theme.primary,
        onRemove: @escaping () -> Void
    ) -> some View {
        HStack(spacing: .spacing.xs) {
            Text(text)
                .font(.theme.caption)
                .foregroundColor(color)

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(color)
            }
        }
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xxs)
        .background(color.opacity(0.1))
        .cornerRadius(.radius.sm)
    }

    private var levelColor: Color {
        switch levelFilter {
        case .all: return Color.theme.primary
        case .error: return Color.theme.error
        case .warning: return Color.theme.warning
        case .info: return Color.theme.info
        case .debug: return Color.theme.mutedForeground
        }
    }
}

// MARK: - Previews

#Preview("Filter Bar") {
    VStack(spacing: 0) {
        LogFilterBar(
            filterText: .constant(""),
            levelFilter: .constant(.all),
            onClear: {}
        )

        LogFilterBar(
            filterText: .constant("error"),
            levelFilter: .constant(.error),
            onClear: {}
        )
    }
}

#Preview("Compact Filter Bar") {
    CompactLogFilterBar(
        filterText: .constant(""),
        levelFilter: .constant(.all),
        onClear: {}
    )
}

#Preview("Filter Chips") {
    HStack(spacing: 8) {
        FilterChip(filter: .all, isSelected: true, onTap: {})
        FilterChip(filter: .error, isSelected: false, onTap: {})
        FilterChip(filter: .warning, isSelected: false, onTap: {})
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Filter Summary") {
    VStack(spacing: 16) {
        FilterSummary(
            filterText: "vllm",
            levelFilter: .error,
            resultCount: 42,
            onClearSearch: {},
            onClearLevel: {}
        )

        FilterSummary(
            filterText: "",
            levelFilter: .warning,
            resultCount: 156,
            onClearSearch: {},
            onClearLevel: {}
        )
    }
}
