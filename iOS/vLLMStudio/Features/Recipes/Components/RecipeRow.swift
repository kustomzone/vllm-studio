import SwiftUI

// MARK: - Recipe Row

struct RecipeRow: View {
    // MARK: - Properties

    let recipe: Recipe
    let isPinned: Bool

    // MARK: - Body

    var body: some View {
        HStack(spacing: .spacing.md) {
            // Status indicator
            statusIndicator

            // Content
            VStack(alignment: .leading, spacing: .spacing.xs) {
                // Name row with pin indicator
                HStack(spacing: .spacing.sm) {
                    Text(recipe.name)
                        .font(.theme.headline)
                        .foregroundStyle(Color.theme.foreground)
                        .lineLimit(1)

                    if isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.theme.primary)
                    }
                }

                // Model path / display name
                Text(recipe.modelDisplayName)
                    .font(.theme.caption)
                    .foregroundStyle(Color.theme.mutedForeground)
                    .lineLimit(1)

                // Tags row
                tagsRow
            }

            Spacer()

            // Status badge
            statusBadge

            // Chevron
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Color.theme.mutedForeground)
        }
        .padding(.vertical, .spacing.sm)
        .contentShape(Rectangle())
    }

    // MARK: - Status Indicator

    private var statusIndicator: some View {
        Circle()
            .fill(statusColor)
            .frame(width: 8, height: 8)
            .overlay {
                if recipe.status == .running {
                    Circle()
                        .stroke(statusColor.opacity(0.4), lineWidth: 4)
                        .frame(width: 16, height: 16)
                }
            }
    }

    // MARK: - Tags Row

    private var tagsRow: some View {
        HStack(spacing: .spacing.sm) {
            // Backend tag
            if let backend = recipe.backend {
                RecipeTag(
                    text: backend.displayName,
                    color: backend == .vllm ? .blue : .purple
                )
            }

            // GPU count tag
            if recipe.totalGpuCount > 1 {
                RecipeTag(
                    text: "\(recipe.totalGpuCount) GPUs",
                    icon: "cpu",
                    color: .orange
                )
            }

            // Quantization tag
            if let quant = recipe.quantization, !quant.isEmpty {
                RecipeTag(
                    text: quant.uppercased(),
                    color: .green
                )
            }
        }
    }

    // MARK: - Status Badge

    private var statusBadge: some View {
        Text(recipe.status.displayName)
            .font(.theme.caption2)
            .fontWeight(.medium)
            .foregroundStyle(statusTextColor)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xxs)
            .background(statusColor.opacity(0.15))
            .clipShape(Capsule())
    }

    // MARK: - Computed Properties

    private var statusColor: Color {
        switch recipe.status {
        case .running:
            return Color.theme.success
        case .starting:
            return Color.theme.warning
        case .ready:
            return Color.theme.info
        case .stopped:
            return Color.theme.mutedForeground
        case .error:
            return Color.theme.error
        }
    }

    private var statusTextColor: Color {
        switch recipe.status {
        case .running:
            return Color.theme.success
        case .starting:
            return Color.theme.warning
        case .ready:
            return Color.theme.info
        case .stopped:
            return Color.theme.mutedForeground
        case .error:
            return Color.theme.error
        }
    }
}

// MARK: - Recipe Tag

struct RecipeTag: View {
    let text: String
    var icon: String?
    let color: Color

    var body: some View {
        HStack(spacing: 2) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 8))
            }
            Text(text)
                .font(.system(size: 10, weight: .medium))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - Preview

#Preview("Running") {
    List {
        RecipeRow(
            recipe: Recipe(
                id: "llama-3",
                name: "Llama 3 70B Instruct",
                modelPath: "/models/meta-llama/Meta-Llama-3-70B-Instruct",
                backend: .vllm,
                status: .running
            ),
            isPinned: true
        )
    }
    .listStyle(.plain)
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Stopped") {
    List {
        RecipeRow(
            recipe: Recipe(
                id: "qwen",
                name: "Qwen 2 72B",
                modelPath: "/models/Qwen/Qwen2-72B-Instruct",
                backend: .sglang,
                status: .stopped
            ),
            isPinned: false
        )
    }
    .listStyle(.plain)
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}

#Preview("Multiple") {
    List {
        RecipeRow(
            recipe: Recipe(
                id: "llama-3",
                name: "Llama 3 70B Instruct",
                modelPath: "/models/meta-llama/Meta-Llama-3-70B-Instruct",
                backend: .vllm,
                status: .running
            ),
            isPinned: true
        )

        RecipeRow(
            recipe: Recipe(
                id: "qwen",
                name: "Qwen 2 72B",
                modelPath: "/models/Qwen/Qwen2-72B-Instruct",
                backend: .sglang,
                status: .ready
            ),
            isPinned: false
        )

        RecipeRow(
            recipe: Recipe(
                id: "deepseek",
                name: "DeepSeek R1",
                modelPath: "/models/deepseek-ai/DeepSeek-R1",
                backend: .vllm,
                status: .stopped
            ),
            isPinned: false
        )
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Color.theme.background)
    .preferredColorScheme(.dark)
}
