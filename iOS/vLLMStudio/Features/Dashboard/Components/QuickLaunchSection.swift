import SwiftUI

/// Section displaying pinned recipes for quick launch
struct QuickLaunchSection: View {
    let recipes: [Recipe]
    let onLaunch: (Recipe) -> Void
    let onViewAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Section header
            HStack {
                Image(systemName: "bolt.fill")
                    .font(.system(size: .iconSize.md))
                    .foregroundStyle(Color.theme.primary)

                Text("Quick Launch")
                    .font(.theme.headline)
                    .foregroundStyle(Color.theme.foreground)

                Spacer()

                Button(action: onViewAll) {
                    Text("View All")
                        .font(.theme.caption)
                        .foregroundStyle(Color.theme.primary)
                }
            }

            if recipes.isEmpty {
                emptyState
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: .spacing.md) {
                        ForEach(recipes) { recipe in
                            QuickLaunchCard(
                                recipe: recipe,
                                onLaunch: { onLaunch(recipe) }
                            )
                        }
                    }
                    .padding(.horizontal, 1) // Prevent clipping
                }
            }
        }
    }

    private var emptyState: some View {
        HStack(spacing: .spacing.md) {
            Image(systemName: "pin.slash")
                .font(.system(size: 24))
                .foregroundStyle(Color.theme.mutedForeground)

            VStack(alignment: .leading, spacing: .spacing.xs) {
                Text("No Pinned Recipes")
                    .font(.theme.body)
                    .foregroundStyle(Color.theme.foreground)

                Text("Pin recipes for quick access")
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
            }

            Spacer()

            Button(action: onViewAll) {
                Text("Browse Recipes")
                    .font(.theme.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.theme.background)
                    .padding(.horizontal, .spacing.md)
                    .padding(.vertical, .spacing.sm)
                    .background(Color.theme.primary)
                    .cornerRadius(.radius.md)
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
}

// MARK: - Quick Launch Card

/// Individual recipe card for quick launch
struct QuickLaunchCard: View {
    let recipe: Recipe
    let onLaunch: () -> Void

    @State private var isPressed = false

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            // Header with status badge
            HStack {
                RecipeStatusBadge(status: recipe.status)
                Spacer()
                if recipe.isPinned {
                    Image(systemName: "pin.fill")
                        .font(.system(size: .iconSize.sm))
                        .foregroundStyle(Color.theme.primary)
                }
            }

            // Recipe name
            Text(recipe.name)
                .font(.theme.body)
                .fontWeight(.medium)
                .foregroundStyle(Color.theme.foreground)
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            // Model ID if available
            if let modelId = recipe.modelId {
                Text(modelId)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .lineLimit(1)
            }

            Spacer()

            // Launch button
            Button(action: onLaunch) {
                HStack(spacing: .spacing.sm) {
                    if recipe.status == .loading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Color.theme.background))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: launchIcon)
                            .font(.system(size: .iconSize.sm))
                    }

                    Text(launchButtonText)
                        .font(.theme.caption)
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, .spacing.sm)
                .background(launchButtonBackground)
                .foregroundStyle(launchButtonForeground)
                .cornerRadius(.radius.md)
            }
            .disabled(!recipe.canLaunch && recipe.status != .running)
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: isPressed)
        }
        .frame(width: 180, height: 160)
        .padding(.spacing.md)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(recipe.isActive ? Color.theme.primary : Color.theme.border, lineWidth: 1)
        )
        .shadow(color: recipe.isActive ? Color.theme.primary.opacity(0.2) : .clear, radius: 8)
    }

    private var launchIcon: String {
        switch recipe.status {
        case .ready, .stopped:
            return "play.fill"
        case .running:
            return "stop.fill"
        case .loading:
            return "hourglass"
        case .error:
            return "exclamationmark.triangle.fill"
        }
    }

    private var launchButtonText: String {
        switch recipe.status {
        case .ready, .stopped:
            return "Launch"
        case .running:
            return "Stop"
        case .loading:
            return "Loading..."
        case .error:
            return "Retry"
        }
    }

    private var launchButtonBackground: Color {
        switch recipe.status {
        case .ready, .stopped:
            return Color.theme.primary
        case .running:
            return Color.theme.error
        case .loading:
            return Color.theme.backgroundSecondary
        case .error:
            return Color.theme.warning
        }
    }

    private var launchButtonForeground: Color {
        switch recipe.status {
        case .loading:
            return Color.theme.mutedForeground
        default:
            return Color.theme.background
        }
    }
}

// MARK: - Recipe Status Badge

/// Badge showing recipe status
struct RecipeStatusBadge: View {
    let status: Recipe.RecipeStatus

    var body: some View {
        HStack(spacing: .spacing.xs) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)

            Text(status.description)
                .font(.theme.caption2)
                .fontWeight(.medium)
        }
        .foregroundStyle(statusColor)
        .padding(.horizontal, .spacing.sm)
        .padding(.vertical, .spacing.xs)
        .background(statusColor.opacity(0.15))
        .cornerRadius(.radius.full)
    }

    private var statusColor: Color {
        switch status {
        case .ready:
            return Color.theme.info
        case .loading:
            return Color.theme.warning
        case .running:
            return Color.theme.success
        case .error:
            return Color.theme.error
        case .stopped:
            return Color.theme.mutedForeground
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        QuickLaunchSection(
            recipes: [
                Recipe(
                    id: "1",
                    name: "Llama 3.1 70B",
                    modelId: "meta-llama/Llama-3.1-70B",
                    description: "Large language model",
                    isPinned: true,
                    status: .ready,
                    lastUsed: Date(),
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                Recipe(
                    id: "2",
                    name: "Qwen 2.5 32B",
                    modelId: "Qwen/Qwen2.5-32B",
                    description: nil,
                    isPinned: true,
                    status: .running,
                    lastUsed: Date(),
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                Recipe(
                    id: "3",
                    name: "Mistral Large",
                    modelId: "mistralai/Mistral-Large",
                    description: nil,
                    isPinned: true,
                    status: .loading,
                    lastUsed: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                Recipe(
                    id: "4",
                    name: "DeepSeek V3",
                    modelId: "deepseek-ai/DeepSeek-V3",
                    description: nil,
                    isPinned: true,
                    status: .error,
                    lastUsed: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            ],
            onLaunch: { _ in },
            onViewAll: {}
        )

        QuickLaunchSection(
            recipes: [],
            onLaunch: { _ in },
            onViewAll: {}
        )
    }
    .padding()
    .background(Color.theme.background)
}
