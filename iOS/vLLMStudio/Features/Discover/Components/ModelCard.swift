import SwiftUI

// MARK: - Model Card

struct ModelCard: View {
    let model: DiscoverModel
    var onAddToRecipes: (() -> Void)?
    var onTap: (() -> Void)?

    @State private var isPressed = false
    @State private var showingDetails = false

    var body: some View {
        Button {
            onTap?()
            showingDetails = true
        } label: {
            VStack(alignment: .leading, spacing: .spacing.md) {
                // Header: Name and Provider
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    Text(model.name)
                        .font(.theme.headline)
                        .foregroundColor(Color.theme.foreground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: .spacing.sm) {
                        ProviderBadge(provider: model.provider)
                        SizeBadge(size: model.size, parameterCount: model.parameterCount)
                    }
                }

                // Description
                Text(model.description)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                // Task type badges
                TaskTypeBadges(taskTypes: model.taskTypes)

                Spacer(minLength: 0)

                // Footer: Stats and Add button
                HStack {
                    // Stats
                    HStack(spacing: .spacing.lg) {
                        StatItem(icon: "arrow.down.circle", value: model.formattedDownloads)
                        StatItem(icon: "heart", value: model.formattedLikes)
                    }

                    Spacer()

                    // Add to Recipes button
                    AddToRecipesButton(action: onAddToRecipes ?? {})
                }
            }
            .padding(.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: .radius.lg)
                    .fill(Color.theme.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .radius.lg)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(CardButtonStyle())
        .sheet(isPresented: $showingDetails) {
            ModelDetailSheet(model: model, onAddToRecipes: onAddToRecipes)
        }
    }
}

// MARK: - Card Button Style

struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.9 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Provider Badge

struct ProviderBadge: View {
    let provider: Provider

    var body: some View {
        Text(provider.displayName)
            .font(.theme.caption2)
            .foregroundColor(Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xxs)
            .background(
                RoundedRectangle(cornerRadius: .radius.sm)
                    .fill(Color.theme.backgroundSecondary)
            )
    }
}

// MARK: - Size Badge

struct SizeBadge: View {
    let size: ModelSize
    let parameterCount: String

    var body: some View {
        Text(parameterCount)
            .font(.theme.caption2)
            .fontWeight(.medium)
            .foregroundColor(Color(hex: size.colorHex))
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xxs)
            .background(
                RoundedRectangle(cornerRadius: .radius.sm)
                    .fill(Color(hex: size.colorHex).opacity(0.15))
            )
    }
}

// MARK: - Task Type Badges

struct TaskTypeBadges: View {
    let taskTypes: [TaskType]
    var maxVisible: Int = 3

    var body: some View {
        HStack(spacing: .spacing.xs) {
            ForEach(Array(taskTypes.prefix(maxVisible))) { taskType in
                TaskTypeBadge(taskType: taskType)
            }

            if taskTypes.count > maxVisible {
                Text("+\(taskTypes.count - maxVisible)")
                    .font(.theme.caption2)
                    .foregroundColor(Color.theme.mutedForeground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xxs)
                    .background(
                        RoundedRectangle(cornerRadius: .radius.sm)
                            .fill(Color.theme.backgroundSecondary)
                    )
            }
        }
    }
}

// MARK: - Task Type Badge

struct TaskTypeBadge: View {
    let taskType: TaskType

    var body: some View {
        HStack(spacing: .spacing.xxs) {
            Image(systemName: taskType.iconName)
                .font(.system(size: 10))

            Text(taskType.displayName)
                .font(.theme.caption2)
        }
        .foregroundColor(Color.theme.primary)
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xxs)
        .background(
            RoundedRectangle(cornerRadius: .radius.sm)
                .fill(Color.theme.primary.opacity(0.15))
        )
    }
}

// MARK: - Stat Item

struct StatItem: View {
    let icon: String
    let value: String

    var body: some View {
        HStack(spacing: .spacing.xxs) {
            Image(systemName: icon)
                .font(.system(size: 12))
            Text(value)
                .font(.theme.caption)
        }
        .foregroundColor(Color.theme.mutedForeground)
    }
}

// MARK: - Add to Recipes Button

struct AddToRecipesButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .semibold))
                Text("Add")
                    .font(.theme.caption)
                    .fontWeight(.medium)
            }
            .foregroundColor(Color.theme.primary)
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: .radius.md)
                    .fill(Color.theme.primary.opacity(0.15))
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Model Detail Sheet

struct ModelDetailSheet: View {
    let model: DiscoverModel
    var onAddToRecipes: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: .spacing.xl) {
                    // Header
                    VStack(alignment: .leading, spacing: .spacing.md) {
                        HStack(spacing: .spacing.md) {
                            ProviderBadge(provider: model.provider)
                            SizeBadge(size: model.size, parameterCount: model.parameterCount)
                        }

                        Text(model.name)
                            .font(.theme.title)
                            .foregroundColor(Color.theme.foreground)

                        Text(model.description)
                            .font(.theme.body)
                            .foregroundColor(Color.theme.mutedForeground)
                    }

                    Divider()
                        .background(Color.theme.border)

                    // Task Types
                    VStack(alignment: .leading, spacing: .spacing.sm) {
                        Text("Capabilities")
                            .font(.theme.headline)
                            .foregroundColor(Color.theme.foreground)

                        FlowLayout(spacing: .spacing.sm) {
                            ForEach(model.taskTypes) { taskType in
                                TaskTypeBadge(taskType: taskType)
                            }
                        }
                    }

                    // Stats
                    VStack(alignment: .leading, spacing: .spacing.sm) {
                        Text("Statistics")
                            .font(.theme.headline)
                            .foregroundColor(Color.theme.foreground)

                        HStack(spacing: .spacing.xl) {
                            DetailStat(title: "Downloads", value: model.formattedDownloads, icon: "arrow.down.circle")
                            DetailStat(title: "Likes", value: model.formattedLikes, icon: "heart")
                        }
                    }

                    // Details
                    VStack(alignment: .leading, spacing: .spacing.sm) {
                        Text("Details")
                            .font(.theme.headline)
                            .foregroundColor(Color.theme.foreground)

                        VStack(spacing: .spacing.sm) {
                            if let contextLength = model.contextLength {
                                DetailRow(label: "Context Length", value: formatNumber(contextLength))
                            }
                            if let license = model.license {
                                DetailRow(label: "License", value: license)
                            }
                            DetailRow(label: "Last Updated", value: formatDate(model.updatedAt))
                        }
                    }

                    // Quantizations
                    if let quantizations = model.quantizations, !quantizations.isEmpty {
                        VStack(alignment: .leading, spacing: .spacing.sm) {
                            Text("Available Quantizations")
                                .font(.theme.headline)
                                .foregroundColor(Color.theme.foreground)

                            FlowLayout(spacing: .spacing.sm) {
                                ForEach(quantizations, id: \.self) { quant in
                                    Text(quant)
                                        .font(.theme.caption)
                                        .foregroundColor(Color.theme.foreground)
                                        .padding(.horizontal, .spacing.md)
                                        .padding(.vertical, .spacing.xs)
                                        .background(
                                            RoundedRectangle(cornerRadius: .radius.sm)
                                                .fill(Color.theme.backgroundSecondary)
                                        )
                                }
                            }
                        }
                    }
                }
                .padding(.spacing.xl)
            }
            .background(Color.theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(Color.theme.primary)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        onAddToRecipes?()
                        dismiss()
                    } label: {
                        Label("Add to Recipes", systemImage: "plus.circle.fill")
                    }
                    .foregroundColor(Color.theme.primary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - Detail Stat

struct DetailStat: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.xs) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.theme.caption)
            }
            .foregroundColor(Color.theme.mutedForeground)

            Text(value)
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)
        }
        .padding(.spacing.md)
        .background(
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(Color.theme.backgroundSecondary)
        )
    }
}

// MARK: - Detail Row

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
            Spacer()
            Text(value)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
        }
        .padding(.spacing.md)
        .background(
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(Color.theme.backgroundSecondary)
        )
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, spacing: spacing, subviews: subviews)
        return CGSize(width: proposal.width ?? 0, height: result.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, spacing: spacing, subviews: subviews)

        for (index, subview) in subviews.enumerated() {
            let point = result.positions[index]
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    struct FlowResult {
        var positions: [CGPoint] = []
        var height: CGFloat = 0

        init(in width: CGFloat, spacing: CGFloat, subviews: Subviews) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)

                if x + size.width > width && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }

                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }

            height = y + lineHeight
        }
    }
}

// MARK: - Compact Model Card (List Item)

struct CompactModelCard: View {
    let model: DiscoverModel
    var onTap: (() -> Void)?
    var onAddToRecipes: (() -> Void)?

    var body: some View {
        Button {
            onTap?()
        } label: {
            HStack(spacing: .spacing.md) {
                // Model Info
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    Text(model.name)
                        .font(.theme.body)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.foreground)
                        .lineLimit(1)

                    HStack(spacing: .spacing.sm) {
                        Text(model.provider.displayName)
                            .font(.theme.caption)
                            .foregroundColor(Color.theme.mutedForeground)

                        Text("*")
                            .foregroundColor(Color.theme.mutedForeground)

                        Text(model.parameterCount)
                            .font(.theme.caption)
                            .foregroundColor(Color(hex: model.size.colorHex))
                    }
                }

                Spacer()

                // Stats
                HStack(spacing: .spacing.md) {
                    StatItem(icon: "arrow.down.circle", value: model.formattedDownloads)
                }

                // Add button
                Button {
                    onAddToRecipes?()
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.system(size: .iconSize.lg))
                        .foregroundColor(Color.theme.primary)
                }
                .buttonStyle(.plain)
            }
            .padding(.spacing.md)
            .background(
                RoundedRectangle(cornerRadius: .radius.md)
                    .fill(Color.theme.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview("Model Card") {
    ScrollView {
        VStack(spacing: 16) {
            ModelCard(model: DiscoverModel.sampleModels[0])
            ModelCard(model: DiscoverModel.sampleModels[1])
        }
        .padding()
    }
    .background(Color.theme.background)
}

#Preview("Compact Model Card") {
    VStack(spacing: 12) {
        CompactModelCard(model: DiscoverModel.sampleModels[0])
        CompactModelCard(model: DiscoverModel.sampleModels[1])
        CompactModelCard(model: DiscoverModel.sampleModels[2])
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Model Detail Sheet") {
    ModelDetailSheet(model: DiscoverModel.sampleModels[0])
}
