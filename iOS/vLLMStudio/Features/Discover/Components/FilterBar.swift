import SwiftUI

// MARK: - Filter Bar

struct FilterBar: View {
    @Binding var selectedTaskType: TaskType?
    @Binding var selectedProvider: Provider?
    @Binding var selectedSize: ModelSize?
    var onClearAll: (() -> Void)?

    var hasActiveFilters: Bool {
        selectedTaskType != nil || selectedProvider != nil || selectedSize != nil
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                // Clear all button
                if hasActiveFilters {
                    ClearFiltersChip {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            selectedTaskType = nil
                            selectedProvider = nil
                            selectedSize = nil
                        }
                        onClearAll?()
                    }
                }

                // Task type filter
                FilterDropdown(
                    title: "Task",
                    icon: "square.grid.2x2",
                    selection: $selectedTaskType,
                    options: TaskType.allCases
                ) { taskType in
                    Label(taskType.displayName, systemImage: taskType.iconName)
                }

                // Provider filter
                FilterDropdown(
                    title: "Provider",
                    icon: "building.2",
                    selection: $selectedProvider,
                    options: Provider.allCases
                ) { provider in
                    Text(provider.displayName)
                }

                // Size filter
                FilterDropdown(
                    title: "Size",
                    icon: "square.stack.3d.up",
                    selection: $selectedSize,
                    options: ModelSize.allCases
                ) { size in
                    Text(size.displayName)
                }
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.sm)
        }
    }
}

// MARK: - Filter Dropdown

struct FilterDropdown<Option: Identifiable & Hashable, Content: View>: View {
    let title: String
    let icon: String
    @Binding var selection: Option?
    let options: [Option]
    @ViewBuilder let optionLabel: (Option) -> Content

    @State private var isExpanded = false

    var isActive: Bool { selection != nil }

    var body: some View {
        Menu {
            // Clear option
            if selection != nil {
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        selection = nil
                    }
                } label: {
                    Label("Clear", systemImage: "xmark")
                }

                Divider()
            }

            // Options
            ForEach(options) { option in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        selection = option
                    }
                } label: {
                    HStack {
                        optionLabel(option)
                        if selection?.id == option.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            FilterChip(
                title: title,
                icon: icon,
                isActive: isActive,
                selectedLabel: selection.map { getDisplayName(for: $0) }
            )
        }
    }

    private func getDisplayName(for option: Option) -> String {
        if let taskType = option as? TaskType {
            return taskType.displayName
        } else if let provider = option as? Provider {
            return provider.displayName
        } else if let size = option as? ModelSize {
            return size.displayName
        }
        return ""
    }
}

// MARK: - Filter Chip

struct FilterChip: View {
    let title: String
    let icon: String
    var isActive: Bool = false
    var selectedLabel: String? = nil

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: .iconSize.sm))

            Text(selectedLabel ?? title)
                .font(.theme.caption)
                .lineLimit(1)

            Image(systemName: "chevron.down")
                .font(.system(size: 10, weight: .semibold))
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .foregroundColor(isActive ? Color.theme.background : Color.theme.foreground)
        .background(
            RoundedRectangle(cornerRadius: .radius.full)
                .fill(isActive ? Color.theme.primary : Color.theme.backgroundSecondary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .radius.full)
                .stroke(isActive ? Color.clear : Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Clear Filters Chip

struct ClearFiltersChip: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))

                Text("Clear")
                    .font(.theme.caption)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .foregroundColor(Color.theme.error)
            .background(
                RoundedRectangle(cornerRadius: .radius.full)
                    .fill(Color.theme.error.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Single Filter Chip (Toggleable)

struct ToggleFilterChip: View {
    let title: String
    let icon: String?
    @Binding var isSelected: Bool

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                isSelected.toggle()
            }
        } label: {
            HStack(spacing: .spacing.xs) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: .iconSize.sm))
                }

                Text(title)
                    .font(.theme.caption)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .foregroundColor(isSelected ? Color.theme.background : Color.theme.foreground)
            .background(
                RoundedRectangle(cornerRadius: .radius.full)
                    .fill(isSelected ? Color.theme.primary : Color.theme.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .radius.full)
                    .stroke(isSelected ? Color.clear : Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Task Type Filter Bar

struct TaskTypeFilterBar: View {
    @Binding var selectedTaskType: TaskType?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                // All option
                FilterSelectionChip(
                    title: "All",
                    icon: "square.grid.2x2",
                    isSelected: selectedTaskType == nil
                ) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        selectedTaskType = nil
                    }
                }

                ForEach(TaskType.allCases) { taskType in
                    FilterSelectionChip(
                        title: taskType.displayName,
                        icon: taskType.iconName,
                        isSelected: selectedTaskType == taskType
                    ) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            selectedTaskType = taskType
                        }
                    }
                }
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.sm)
        }
    }
}

// MARK: - Filter Selection Chip

struct FilterSelectionChip: View {
    let title: String
    let icon: String
    var isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: .iconSize.sm))

                Text(title)
                    .font(.theme.caption)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .foregroundColor(isSelected ? Color.theme.background : Color.theme.foreground)
            .background(
                RoundedRectangle(cornerRadius: .radius.full)
                    .fill(isSelected ? Color.theme.primary : Color.theme.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .radius.full)
                    .stroke(isSelected ? Color.clear : Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Filter Bar") {
    VStack(spacing: 20) {
        FilterBar(
            selectedTaskType: .constant(nil),
            selectedProvider: .constant(nil),
            selectedSize: .constant(nil)
        )

        FilterBar(
            selectedTaskType: .constant(.chatCompletion),
            selectedProvider: .constant(.meta),
            selectedSize: .constant(nil)
        )
    }
    .background(Color.theme.background)
}

#Preview("Task Type Filter Bar") {
    VStack(spacing: 20) {
        TaskTypeFilterBar(selectedTaskType: .constant(nil))
        TaskTypeFilterBar(selectedTaskType: .constant(.codeGeneration))
    }
    .background(Color.theme.background)
}

#Preview("Filter Chips") {
    HStack(spacing: 10) {
        FilterChip(title: "Task", icon: "square.grid.2x2")
        FilterChip(title: "Chat", icon: "bubble.left", isActive: true)
        ClearFiltersChip {}
    }
    .padding()
    .background(Color.theme.background)
}
