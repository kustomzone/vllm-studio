//
//  ShimmerModifier.swift
//  vLLMStudio
//
//  Loading shimmer animation effect matching the web design system
//

import SwiftUI

// MARK: - Shimmer Modifier

/// A ViewModifier that adds a shimmer loading animation effect
struct ShimmerModifier: ViewModifier {
    // MARK: - Properties

    /// Whether the shimmer animation is active
    var isActive: Bool

    /// Base color of the shimmer (default: #2d2d2d)
    var baseColor: Color

    /// Highlight color of the shimmer (default: #3d3d3d)
    var highlightColor: Color

    /// Animation duration in seconds
    var duration: Double

    /// Corner radius for the shimmer overlay
    var cornerRadius: CGFloat

    @State private var phase: CGFloat = 0

    // MARK: - Initialization

    init(
        isActive: Bool = true,
        baseColor: Color = Color.theme.shimmerBase,
        highlightColor: Color = Color.theme.shimmerHighlight,
        duration: Double = Theme.animation.shimmerDuration,
        cornerRadius: CGFloat = Theme.radius.md
    ) {
        self.isActive = isActive
        self.baseColor = baseColor
        self.highlightColor = highlightColor
        self.duration = duration
        self.cornerRadius = cornerRadius
    }

    // MARK: - Body

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    if isActive {
                        shimmerGradient(width: geometry.size.width)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            )
            .onAppear {
                guard isActive else { return }
                withAnimation(
                    Animation.linear(duration: duration)
                        .repeatForever(autoreverses: false)
                ) {
                    phase = 1
                }
            }
            .onChange(of: isActive) { _, newValue in
                if newValue {
                    phase = 0
                    withAnimation(
                        Animation.linear(duration: duration)
                            .repeatForever(autoreverses: false)
                    ) {
                        phase = 1
                    }
                }
            }
    }

    @ViewBuilder
    private func shimmerGradient(width: CGFloat) -> some View {
        let gradientWidth = width * 0.7

        LinearGradient(
            gradient: Gradient(colors: [
                baseColor.opacity(0),
                highlightColor.opacity(0.5),
                baseColor.opacity(0)
            ]),
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: gradientWidth)
        .offset(x: -gradientWidth + (width + gradientWidth * 2) * phase)
    }
}

// MARK: - Shimmer View

/// A standalone shimmer placeholder view
struct ShimmerView: View {
    // MARK: - Properties

    var width: CGFloat?
    var height: CGFloat
    var cornerRadius: CGFloat

    @State private var phase: CGFloat = 0

    // MARK: - Initialization

    init(
        width: CGFloat? = nil,
        height: CGFloat = 20,
        cornerRadius: CGFloat = Theme.radius.md
    ) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            let resolvedWidth = width ?? geometry.size.width
            let gradientWidth = resolvedWidth * 0.7

            RoundedRectangle(cornerRadius: cornerRadius)
                .fill(Color.theme.shimmerBase)
                .overlay(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.theme.shimmerBase.opacity(0),
                            Color.theme.shimmerHighlight.opacity(0.6),
                            Color.theme.shimmerBase.opacity(0)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: gradientWidth)
                    .offset(x: -gradientWidth + (resolvedWidth + gradientWidth * 2) * phase)
                )
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        }
        .frame(width: width, height: height)
        .onAppear {
            withAnimation(
                Animation.linear(duration: Theme.animation.shimmerDuration)
                    .repeatForever(autoreverses: false)
            ) {
                phase = 1
            }
        }
    }
}

// MARK: - Skeleton Loading Components

/// Text skeleton placeholder
struct SkeletonText: View {
    var lines: Int
    var lastLineWidth: CGFloat

    init(lines: Int = 1, lastLineWidth: CGFloat = 0.7) {
        self.lines = lines
        self.lastLineWidth = lastLineWidth
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(0..<lines, id: \.self) { index in
                GeometryReader { geometry in
                    let isLastLine = index == lines - 1
                    let width = isLastLine ? geometry.size.width * lastLineWidth : geometry.size.width

                    ShimmerView(width: width, height: 14, cornerRadius: 4)
                }
                .frame(height: 14)
            }
        }
    }
}

/// Avatar skeleton placeholder
struct SkeletonAvatar: View {
    var size: CGFloat
    var isCircle: Bool

    init(size: CGFloat = 40, isCircle: Bool = true) {
        self.size = size
        self.isCircle = isCircle
    }

    var body: some View {
        ShimmerView(
            width: size,
            height: size,
            cornerRadius: isCircle ? size / 2 : Theme.radius.md
        )
    }
}

/// Card skeleton placeholder
struct SkeletonCard: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                SkeletonAvatar(size: 40)

                VStack(alignment: .leading, spacing: 6) {
                    ShimmerView(width: 120, height: 14, cornerRadius: 4)
                    ShimmerView(width: 80, height: 12, cornerRadius: 4)
                }
            }

            SkeletonText(lines: 3, lastLineWidth: 0.6)
        }
        .padding(Theme.spacing.cardPadding)
        .background(
            RoundedRectangle(cornerRadius: Theme.radius.card)
                .fill(Color.theme.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radius.card)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

/// List item skeleton placeholder
struct SkeletonListItem: View {
    var hasAvatar: Bool
    var hasSubtitle: Bool

    init(hasAvatar: Bool = true, hasSubtitle: Bool = true) {
        self.hasAvatar = hasAvatar
        self.hasSubtitle = hasSubtitle
    }

    var body: some View {
        HStack(spacing: 12) {
            if hasAvatar {
                SkeletonAvatar(size: 44)
            }

            VStack(alignment: .leading, spacing: 6) {
                ShimmerView(height: 16, cornerRadius: 4)
                    .frame(width: 150)

                if hasSubtitle {
                    ShimmerView(height: 12, cornerRadius: 4)
                        .frame(width: 100)
                }
            }

            Spacer()

            ShimmerView(width: 60, height: 24, cornerRadius: Theme.radius.sm)
        }
        .padding(.vertical, 8)
    }
}

/// Button skeleton placeholder
struct SkeletonButton: View {
    var width: CGFloat
    var height: CGFloat

    init(width: CGFloat = 100, height: CGFloat = 40) {
        self.width = width
        self.height = height
    }

    var body: some View {
        ShimmerView(
            width: width,
            height: height,
            cornerRadius: Theme.radius.button
        )
    }
}

// MARK: - View Extensions

extension View {
    /// Apply shimmer effect to view
    func shimmer(
        isActive: Bool = true,
        cornerRadius: CGFloat = Theme.radius.md
    ) -> some View {
        modifier(ShimmerModifier(
            isActive: isActive,
            cornerRadius: cornerRadius
        ))
    }

    /// Apply shimmer effect with custom colors
    func shimmer(
        isActive: Bool = true,
        baseColor: Color,
        highlightColor: Color,
        cornerRadius: CGFloat = Theme.radius.md
    ) -> some View {
        modifier(ShimmerModifier(
            isActive: isActive,
            baseColor: baseColor,
            highlightColor: highlightColor,
            cornerRadius: cornerRadius
        ))
    }

    /// Show skeleton loading state or actual content
    @ViewBuilder
    func skeleton(
        isLoading: Bool,
        @ViewBuilder skeleton: () -> some View
    ) -> some View {
        if isLoading {
            skeleton()
        } else {
            self
        }
    }
}

// MARK: - Preview Provider

#Preview("Shimmer & Skeletons") {
    ScrollView {
        VStack(spacing: 24) {
            // Shimmer on existing view
            VStack(alignment: .leading, spacing: 8) {
                Text("Shimmer on View")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                RoundedRectangle(cornerRadius: Theme.radius.md)
                    .fill(Color.theme.backgroundSecondary)
                    .frame(height: 60)
                    .shimmer()
            }

            Divider()
                .background(Color.theme.border)

            // ShimmerView standalone
            VStack(alignment: .leading, spacing: 8) {
                Text("Shimmer View")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                VStack(spacing: 8) {
                    ShimmerView(height: 20)
                    ShimmerView(width: 200, height: 16)
                    ShimmerView(width: 150, height: 12)
                }
            }

            Divider()
                .background(Color.theme.border)

            // Skeleton Text
            VStack(alignment: .leading, spacing: 8) {
                Text("Skeleton Text")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                SkeletonText(lines: 3, lastLineWidth: 0.5)
                    .frame(height: 50)
            }

            Divider()
                .background(Color.theme.border)

            // Skeleton Avatar
            VStack(alignment: .leading, spacing: 8) {
                Text("Skeleton Avatars")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 16) {
                    SkeletonAvatar(size: 32)
                    SkeletonAvatar(size: 44)
                    SkeletonAvatar(size: 56)
                    SkeletonAvatar(size: 44, isCircle: false)
                }
            }

            Divider()
                .background(Color.theme.border)

            // Skeleton Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Skeleton Card")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                SkeletonCard()
            }

            Divider()
                .background(Color.theme.border)

            // Skeleton List Items
            VStack(alignment: .leading, spacing: 8) {
                Text("Skeleton List Items")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                VStack(spacing: 0) {
                    SkeletonListItem()
                    Divider().background(Color.theme.border)
                    SkeletonListItem()
                    Divider().background(Color.theme.border)
                    SkeletonListItem(hasAvatar: false)
                }
            }

            Divider()
                .background(Color.theme.border)

            // Skeleton Buttons
            VStack(alignment: .leading, spacing: 8) {
                Text("Skeleton Buttons")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    SkeletonButton(width: 80, height: 36)
                    SkeletonButton(width: 100, height: 40)
                    SkeletonButton(width: 120, height: 44)
                }
            }
        }
        .padding()
    }
    .background(Color.theme.background)
}
