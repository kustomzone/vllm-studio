import SwiftUI

/// A refresh button with rotation animation
struct RefreshButton: View {
    let action: () -> Void
    var isRefreshing: Bool
    var size: ButtonSize

    @State private var rotation: Double = 0

    init(
        isRefreshing: Bool = false,
        size: ButtonSize = .medium,
        action: @escaping () -> Void
    ) {
        self.isRefreshing = isRefreshing
        self.size = size
        self.action = action
    }

    var body: some View {
        Button(action: {
            if !isRefreshing {
                // Trigger one full rotation on tap
                withAnimation(.easeInOut(duration: 0.5)) {
                    rotation += 360
                }
                action()
            }
        }) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: size.iconSize, weight: .medium))
                .foregroundColor(isRefreshing ? Color.theme.mutedForeground : Color.theme.primary)
                .rotationEffect(.degrees(rotation))
                .frame(width: size.frameSize, height: size.frameSize)
                .background(
                    Circle()
                        .fill(Color.theme.primary.opacity(isRefreshing ? 0.05 : 0.1))
                )
        }
        .disabled(isRefreshing)
        .onChange(of: isRefreshing) { _, newValue in
            if newValue {
                startContinuousRotation()
            }
        }
    }

    private func startContinuousRotation() {
        withAnimation(
            .linear(duration: 1)
            .repeatForever(autoreverses: false)
        ) {
            rotation += 360
        }
    }
}

// MARK: - Button Size

extension RefreshButton {
    enum ButtonSize {
        case small
        case medium
        case large

        var iconSize: CGFloat {
            switch self {
            case .small: return 12
            case .medium: return 16
            case .large: return 20
            }
        }

        var frameSize: CGFloat {
            switch self {
            case .small: return 28
            case .medium: return 36
            case .large: return 44
            }
        }
    }
}

// MARK: - Text Refresh Button

/// A refresh button with text label
struct RefreshButtonWithLabel: View {
    let label: String
    let action: () -> Void
    var isRefreshing: Bool

    @State private var rotation: Double = 0

    init(
        label: String = "Refresh",
        isRefreshing: Bool = false,
        action: @escaping () -> Void
    ) {
        self.label = label
        self.isRefreshing = isRefreshing
        self.action = action
    }

    var body: some View {
        Button(action: {
            if !isRefreshing {
                withAnimation(.easeInOut(duration: 0.5)) {
                    rotation += 360
                }
                action()
            }
        }) {
            HStack(spacing: .spacing.sm) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 14, weight: .medium))
                    .rotationEffect(.degrees(rotation))

                Text(isRefreshing ? "Refreshing..." : label)
                    .font(.theme.body)
                    .fontWeight(.medium)
            }
            .foregroundColor(isRefreshing ? Color.theme.mutedForeground : Color.theme.primary)
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.sm)
            .background(Color.theme.primary.opacity(isRefreshing ? 0.05 : 0.1))
            .cornerRadius(.radius.md)
        }
        .disabled(isRefreshing)
        .onChange(of: isRefreshing) { _, newValue in
            if newValue {
                withAnimation(
                    .linear(duration: 1)
                    .repeatForever(autoreverses: false)
                ) {
                    rotation += 360
                }
            }
        }
    }
}

// MARK: - Toolbar Refresh Button

/// A refresh button styled for use in navigation toolbars
struct ToolbarRefreshButton: View {
    let action: () -> Void
    var isRefreshing: Bool

    @State private var rotation: Double = 0

    init(isRefreshing: Bool = false, action: @escaping () -> Void) {
        self.isRefreshing = isRefreshing
        self.action = action
    }

    var body: some View {
        Button(action: {
            if !isRefreshing {
                withAnimation(.easeInOut(duration: 0.5)) {
                    rotation += 360
                }
                action()
            }
        }) {
            Image(systemName: "arrow.clockwise")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isRefreshing ? Color.theme.mutedForeground : Color.theme.foreground)
                .rotationEffect(.degrees(rotation))
        }
        .disabled(isRefreshing)
        .onChange(of: isRefreshing) { _, newValue in
            if newValue {
                withAnimation(
                    .linear(duration: 1)
                    .repeatForever(autoreverses: false)
                ) {
                    rotation += 360
                }
            }
        }
    }
}

// MARK: - Previews

#Preview("Refresh Button Sizes") {
    HStack(spacing: 20) {
        RefreshButton(size: .small) { print("Small refresh") }
        RefreshButton(size: .medium) { print("Medium refresh") }
        RefreshButton(size: .large) { print("Large refresh") }
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Refresh Button States") {
    VStack(spacing: 20) {
        RefreshButton(isRefreshing: false) { print("Refresh") }
        RefreshButton(isRefreshing: true) { print("Refresh") }
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Refresh Button With Label") {
    VStack(spacing: 20) {
        RefreshButtonWithLabel(isRefreshing: false) { print("Refresh") }
        RefreshButtonWithLabel(isRefreshing: true) { print("Refresh") }
    }
    .padding()
    .background(Color.theme.background)
}
