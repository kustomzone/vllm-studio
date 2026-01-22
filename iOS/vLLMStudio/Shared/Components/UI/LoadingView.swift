import SwiftUI

/// A themed loading indicator with optional message
struct LoadingView: View {
    let message: String?
    var size: LoadingSize

    init(message: String? = nil, size: LoadingSize = .medium) {
        self.message = message
        self.size = size
    }

    var body: some View {
        VStack(spacing: .spacing.md) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color.theme.primary))
                .scaleEffect(size.scale)

            if let message = message {
                Text(message)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Loading Size

extension LoadingView {
    enum LoadingSize {
        case small
        case medium
        case large

        var scale: CGFloat {
            switch self {
            case .small: return 0.8
            case .medium: return 1.0
            case .large: return 1.5
            }
        }
    }
}

// MARK: - Inline Loading View

/// A smaller loading indicator for inline use
struct InlineLoadingView: View {
    let message: String?

    init(message: String? = nil) {
        self.message = message
    }

    var body: some View {
        HStack(spacing: .spacing.sm) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color.theme.primary))
                .scaleEffect(0.8)

            if let message = message {
                Text(message)
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }
        }
    }
}

// MARK: - Skeleton Loading View

/// A shimmer placeholder for loading content
struct SkeletonView: View {
    let width: CGFloat?
    let height: CGFloat

    @State private var isAnimating = false

    init(width: CGFloat? = nil, height: CGFloat = 20) {
        self.width = width
        self.height = height
    }

    var body: some View {
        RoundedRectangle(cornerRadius: .radius.sm)
            .fill(
                LinearGradient(
                    colors: [
                        Color.theme.backgroundSecondary,
                        Color.theme.backgroundTertiary,
                        Color.theme.backgroundSecondary
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: width, height: height)
            .mask(
                RoundedRectangle(cornerRadius: .radius.sm)
                    .fill(
                        LinearGradient(
                            colors: [
                                .clear,
                                .white.opacity(0.5),
                                .clear
                            ],
                            startPoint: isAnimating ? .leading : .trailing,
                            endPoint: isAnimating ? .trailing : .leading
                        )
                    )
                    .offset(x: isAnimating ? 200 : -200)
            )
            .onAppear {
                withAnimation(
                    .linear(duration: 1.5)
                    .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Previews

#Preview("Loading View") {
    LoadingView(message: "Loading data...")
}

#Preview("Inline Loading") {
    InlineLoadingView(message: "Processing...")
        .padding()
        .background(Color.theme.background)
}

#Preview("Skeleton") {
    VStack(spacing: 12) {
        SkeletonView(width: 200, height: 24)
        SkeletonView(height: 16)
        SkeletonView(width: 150, height: 16)
    }
    .padding()
    .background(Color.theme.background)
}
