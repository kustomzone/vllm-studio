//
//  CardStyles.swift
//  vLLMStudio
//
//  Card styles and view modifiers matching the web design system
//

import SwiftUI

// MARK: - Card Style

/// Standard card style with background, border, and optional shadow
struct CardStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.card
    var borderColor: Color = Color.theme.border
    var cornerRadius: CGFloat = Theme.radius.card
    var borderWidth: CGFloat = 1
    var hasShadow: Bool = true
    var padding: CGFloat = Theme.spacing.cardPadding

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(borderColor, lineWidth: borderWidth)
            )
            .shadow(
                color: hasShadow ? Color.black.opacity(0.4) : Color.clear,
                radius: hasShadow ? 8 : 0,
                x: 0,
                y: hasShadow ? 4 : 0
            )
    }
}

// MARK: - Interactive Card Style

/// Card style with hover/press states
struct InteractiveCardStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.card
    var hoverBackgroundColor: Color = Color.theme.backgroundTertiary
    var borderColor: Color = Color.theme.border
    var hoverBorderColor: Color = Color.theme.borderLight
    var cornerRadius: CGFloat = Theme.radius.card
    var padding: CGFloat = Theme.spacing.cardPadding

    @State private var isHovered = false
    @State private var isPressed = false

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(isPressed ? hoverBackgroundColor : (isHovered ? hoverBackgroundColor.opacity(0.5) : backgroundColor))
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(isHovered || isPressed ? hoverBorderColor : borderColor, lineWidth: 1)
            )
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(Theme.animation.fast, value: isPressed)
            .animation(Theme.animation.fast, value: isHovered)
            .onHover { hovering in
                isHovered = hovering
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
    }
}

// MARK: - Elevated Card Style

/// Card with more prominent shadow for emphasis
struct ElevatedCardStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.card
    var borderColor: Color = Color.theme.border
    var cornerRadius: CGFloat = Theme.radius.card
    var padding: CGFloat = Theme.spacing.cardPadding

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(borderColor, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.5), radius: 16, x: 0, y: 8)
    }
}

// MARK: - Outlined Card Style

/// Card with only border, no fill
struct OutlinedCardStyle: ViewModifier {
    var borderColor: Color = Color.theme.border
    var cornerRadius: CGFloat = Theme.radius.card
    var borderWidth: CGFloat = 1
    var padding: CGFloat = Theme.spacing.cardPadding

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(borderColor, lineWidth: borderWidth)
            )
    }
}

// MARK: - Highlighted Card Style

/// Card with accent color border for emphasis
struct HighlightedCardStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.card
    var accentColor: Color = Color.theme.primary
    var cornerRadius: CGFloat = Theme.radius.card
    var padding: CGFloat = Theme.spacing.cardPadding

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(accentColor, lineWidth: 2)
            )
            .shadow(color: accentColor.opacity(0.3), radius: 12, x: 0, y: 4)
    }
}

// MARK: - Status Card Style

/// Card with status-specific styling
struct StatusCardStyle: ViewModifier {
    var status: StatusType
    var cornerRadius: CGFloat = Theme.radius.card
    var padding: CGFloat = Theme.spacing.cardPadding

    enum StatusType {
        case success
        case error
        case warning
        case info
        case neutral

        var backgroundColor: Color {
            switch self {
            case .success:
                return Color.theme.successMuted
            case .error:
                return Color.theme.errorMuted
            case .warning:
                return Color.theme.warningMuted
            case .info:
                return Color.theme.infoMuted
            case .neutral:
                return Color.theme.card
            }
        }

        var borderColor: Color {
            switch self {
            case .success:
                return Color.theme.success.opacity(0.5)
            case .error:
                return Color.theme.error.opacity(0.5)
            case .warning:
                return Color.theme.warning.opacity(0.5)
            case .info:
                return Color.theme.info.opacity(0.5)
            case .neutral:
                return Color.theme.border
            }
        }

        var accentColor: Color {
            switch self {
            case .success:
                return Color.theme.success
            case .error:
                return Color.theme.error
            case .warning:
                return Color.theme.warning
            case .info:
                return Color.theme.info
            case .neutral:
                return Color.theme.mutedForeground
            }
        }
    }

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(status.backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(status.borderColor, lineWidth: 1)
            )
    }
}

// MARK: - Inset Card Style

/// Card that appears inset/recessed
struct InsetCardStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.backgroundSecondary
    var cornerRadius: CGFloat = Theme.radius.md
    var padding: CGFloat = Theme.spacing.md

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.theme.border.opacity(0.5), lineWidth: 1)
            )
    }
}

// MARK: - View Extensions

extension View {
    /// Apply standard card style
    func cardStyle(
        backgroundColor: Color = Color.theme.card,
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        hasShadow: Bool = true,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(CardStyle(
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            cornerRadius: cornerRadius,
            hasShadow: hasShadow,
            padding: padding
        ))
    }

    /// Apply interactive card style
    func interactiveCardStyle(
        backgroundColor: Color = Color.theme.card,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(InteractiveCardStyle(
            backgroundColor: backgroundColor,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }

    /// Apply elevated card style
    func elevatedCardStyle(
        backgroundColor: Color = Color.theme.card,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(ElevatedCardStyle(
            backgroundColor: backgroundColor,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }

    /// Apply outlined card style
    func outlinedCardStyle(
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(OutlinedCardStyle(
            borderColor: borderColor,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }

    /// Apply highlighted card style
    func highlightedCardStyle(
        accentColor: Color = Color.theme.primary,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(HighlightedCardStyle(
            accentColor: accentColor,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }

    /// Apply status card style
    func statusCardStyle(
        _ status: StatusCardStyle.StatusType,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: CGFloat = Theme.spacing.cardPadding
    ) -> some View {
        modifier(StatusCardStyle(
            status: status,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }

    /// Apply inset card style
    func insetCardStyle(
        backgroundColor: Color = Color.theme.backgroundSecondary,
        cornerRadius: CGFloat = Theme.radius.md,
        padding: CGFloat = Theme.spacing.md
    ) -> some View {
        modifier(InsetCardStyle(
            backgroundColor: backgroundColor,
            cornerRadius: cornerRadius,
            padding: padding
        ))
    }
}

// MARK: - Card View Component

/// Reusable card container view
struct Card<Content: View>: View {
    let content: Content

    var backgroundColor: Color = Color.theme.card
    var borderColor: Color = Color.theme.border
    var cornerRadius: CGFloat = Theme.radius.card
    var hasShadow: Bool = true
    var padding: CGFloat = Theme.spacing.cardPadding

    init(
        backgroundColor: Color = Color.theme.card,
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        hasShadow: Bool = true,
        padding: CGFloat = Theme.spacing.cardPadding,
        @ViewBuilder content: () -> Content
    ) {
        self.backgroundColor = backgroundColor
        self.borderColor = borderColor
        self.cornerRadius = cornerRadius
        self.hasShadow = hasShadow
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .cardStyle(
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                cornerRadius: cornerRadius,
                hasShadow: hasShadow,
                padding: padding
            )
    }
}

// MARK: - Preview Provider

#Preview("Card Styles") {
    ScrollView {
        VStack(spacing: 20) {
            // Standard Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Standard Card")
                    .headlineStyle()
                Text("Default card with background, border, and shadow")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()

            // Card without shadow
            VStack(alignment: .leading, spacing: 8) {
                Text("Flat Card")
                    .headlineStyle()
                Text("Card without shadow")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle(hasShadow: false)

            // Elevated Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Elevated Card")
                    .headlineStyle()
                Text("Card with prominent shadow")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .elevatedCardStyle()

            // Outlined Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Outlined Card")
                    .headlineStyle()
                Text("Border only, no fill")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .outlinedCardStyle()

            // Highlighted Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Highlighted Card")
                    .headlineStyle()
                Text("Accent border with glow")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .highlightedCardStyle()

            // Status Cards
            HStack(spacing: 12) {
                VStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color.theme.success)
                    Text("Success")
                        .captionStyle()
                }
                .frame(maxWidth: .infinity)
                .statusCardStyle(.success)

                VStack {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(Color.theme.error)
                    Text("Error")
                        .captionStyle()
                }
                .frame(maxWidth: .infinity)
                .statusCardStyle(.error)

                VStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(Color.theme.warning)
                    Text("Warning")
                        .captionStyle()
                }
                .frame(maxWidth: .infinity)
                .statusCardStyle(.warning)
            }

            // Inset Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Inset Card")
                    .headlineStyle()
                Text("Appears recessed")
                    .captionStyle()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .insetCardStyle()

            // Using Card component
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Card Component")
                        .headlineStyle()
                    Text("Using the Card view directly")
                        .captionStyle()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
    }
    .background(Color.theme.background)
}
