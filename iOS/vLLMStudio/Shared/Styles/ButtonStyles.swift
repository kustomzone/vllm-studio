//
//  ButtonStyles.swift
//  vLLMStudio
//
//  Custom button styles matching the web design system
//

import SwiftUI

// MARK: - Primary Button Style

/// Orange filled button style - main call-to-action
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var size: ButtonSize = .medium
    var isFullWidth: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(isEnabled ? .white : Color.theme.disabledForeground)
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return Color.theme.disabled
        }
        return isPressed ? Color.theme.primaryHover : Color.theme.primary
    }
}

// MARK: - Secondary Button Style

/// Outlined button style - secondary actions
struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var size: ButtonSize = .medium
    var isFullWidth: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(isEnabled ? Color.theme.foreground : Color.theme.disabledForeground)
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .fill(configuration.isPressed ? Color.theme.backgroundTertiary : Color.theme.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .stroke(
                        isEnabled ? Color.theme.border : Color.theme.disabled,
                        lineWidth: 1
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }
}

// MARK: - Ghost Button Style

/// Transparent button style - subtle actions
struct GhostButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var size: ButtonSize = .medium
    var isFullWidth: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(
                isEnabled
                    ? (configuration.isPressed ? Color.theme.foreground : Color.theme.mutedForeground)
                    : Color.theme.disabledForeground
            )
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .fill(configuration.isPressed ? Color.theme.backgroundTertiary : Color.clear)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }
}

// MARK: - Destructive Button Style

/// Red button style - dangerous/delete actions
struct DestructiveButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var size: ButtonSize = .medium
    var isFullWidth: Bool = false
    var variant: DestructiveVariant = .filled

    enum DestructiveVariant {
        case filled
        case outlined
        case ghost
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(size.font)
            .foregroundColor(foregroundColor(isPressed: configuration.isPressed))
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .background(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.radius.button)
                    .stroke(borderColor, lineWidth: variant == .outlined ? 1 : 0)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }

    private func foregroundColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return Color.theme.disabledForeground
        }
        switch variant {
        case .filled:
            return .white
        case .outlined, .ghost:
            return isPressed ? Color.theme.error.lighter(by: 0.1) : Color.theme.error
        }
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return variant == .filled ? Color.theme.disabled : Color.clear
        }
        switch variant {
        case .filled:
            return isPressed ? Color.theme.error.darker(by: 0.1) : Color.theme.error
        case .outlined:
            return isPressed ? Color.theme.errorMuted : Color.clear
        case .ghost:
            return isPressed ? Color.theme.errorMuted : Color.clear
        }
    }

    private var borderColor: Color {
        if !isEnabled {
            return Color.theme.disabled
        }
        return Color.theme.error
    }
}

// MARK: - Icon Button Style

/// Circular icon button style
struct IconButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var size: IconButtonSize = .medium
    var variant: IconButtonVariant = .ghost

    enum IconButtonVariant {
        case filled
        case outlined
        case ghost
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: size.iconSize, weight: .medium))
            .foregroundColor(foregroundColor(isPressed: configuration.isPressed))
            .frame(width: size.dimension, height: size.dimension)
            .background(
                Circle()
                    .fill(backgroundColor(isPressed: configuration.isPressed))
            )
            .overlay(
                Circle()
                    .stroke(borderColor(isPressed: configuration.isPressed), lineWidth: variant == .outlined ? 1 : 0)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }

    private func foregroundColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return Color.theme.disabledForeground
        }
        switch variant {
        case .filled:
            return .white
        case .outlined, .ghost:
            return isPressed ? Color.theme.foreground : Color.theme.mutedForeground
        }
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return variant == .filled ? Color.theme.disabled : Color.clear
        }
        switch variant {
        case .filled:
            return isPressed ? Color.theme.primaryHover : Color.theme.primary
        case .outlined:
            return isPressed ? Color.theme.backgroundTertiary : Color.clear
        case .ghost:
            return isPressed ? Color.theme.backgroundTertiary : Color.clear
        }
    }

    private func borderColor(isPressed: Bool) -> Color {
        if !isEnabled {
            return Color.theme.disabled
        }
        return isPressed ? Color.theme.borderLight : Color.theme.border
    }
}

// MARK: - Link Button Style

/// Text link style - inline actions
struct LinkButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    var color: Color = Color.theme.primary

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.theme.body)
            .foregroundColor(
                isEnabled
                    ? (configuration.isPressed ? color.opacity(0.7) : color)
                    : Color.theme.disabledForeground
            )
            .underline(configuration.isPressed)
            .animation(Theme.animation.fast, value: configuration.isPressed)
    }
}

// MARK: - Button Size

enum ButtonSize {
    case small
    case medium
    case large

    var font: Font {
        switch self {
        case .small:
            return .theme.buttonSmall
        case .medium:
            return .theme.button
        case .large:
            return .theme.buttonLarge
        }
    }

    var horizontalPadding: CGFloat {
        switch self {
        case .small:
            return 12
        case .medium:
            return 16
        case .large:
            return 24
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .small:
            return 6
        case .medium:
            return 10
        case .large:
            return 14
        }
    }
}

// MARK: - Icon Button Size

enum IconButtonSize {
    case small
    case medium
    case large

    var dimension: CGFloat {
        switch self {
        case .small:
            return 32
        case .medium:
            return 40
        case .large:
            return 48
        }
    }

    var iconSize: CGFloat {
        switch self {
        case .small:
            return 14
        case .medium:
            return 18
        case .large:
            return 22
        }
    }
}

// MARK: - Button Style Extensions

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
    static func primary(size: ButtonSize = .medium, fullWidth: Bool = false) -> PrimaryButtonStyle {
        PrimaryButtonStyle(size: size, isFullWidth: fullWidth)
    }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
    static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
    static func secondary(size: ButtonSize = .medium, fullWidth: Bool = false) -> SecondaryButtonStyle {
        SecondaryButtonStyle(size: size, isFullWidth: fullWidth)
    }
}

extension ButtonStyle where Self == GhostButtonStyle {
    static var ghost: GhostButtonStyle { GhostButtonStyle() }
    static func ghost(size: ButtonSize = .medium, fullWidth: Bool = false) -> GhostButtonStyle {
        GhostButtonStyle(size: size, isFullWidth: fullWidth)
    }
}

extension ButtonStyle where Self == DestructiveButtonStyle {
    static var destructive: DestructiveButtonStyle { DestructiveButtonStyle() }
    static func destructive(
        size: ButtonSize = .medium,
        fullWidth: Bool = false,
        variant: DestructiveButtonStyle.DestructiveVariant = .filled
    ) -> DestructiveButtonStyle {
        DestructiveButtonStyle(size: size, isFullWidth: fullWidth, variant: variant)
    }
}

extension ButtonStyle where Self == IconButtonStyle {
    static var icon: IconButtonStyle { IconButtonStyle() }
    static func icon(
        size: IconButtonSize = .medium,
        variant: IconButtonStyle.IconButtonVariant = .ghost
    ) -> IconButtonStyle {
        IconButtonStyle(size: size, variant: variant)
    }
}

extension ButtonStyle where Self == LinkButtonStyle {
    static var link: LinkButtonStyle { LinkButtonStyle() }
    static func link(color: Color = Color.theme.primary) -> LinkButtonStyle {
        LinkButtonStyle(color: color)
    }
}

// MARK: - Preview Provider

#Preview("Button Styles") {
    ScrollView {
        VStack(spacing: 24) {
            // Primary Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Primary")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button("Small") {}
                        .buttonStyle(.primary(size: .small))

                    Button("Medium") {}
                        .buttonStyle(.primary)

                    Button("Large") {}
                        .buttonStyle(.primary(size: .large))
                }

                Button("Full Width") {}
                    .buttonStyle(.primary(fullWidth: true))

                Button("Disabled") {}
                    .buttonStyle(.primary)
                    .disabled(true)
            }

            Divider()
                .background(Color.theme.border)

            // Secondary Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Secondary")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button("Small") {}
                        .buttonStyle(.secondary(size: .small))

                    Button("Medium") {}
                        .buttonStyle(.secondary)

                    Button("Large") {}
                        .buttonStyle(.secondary(size: .large))
                }
            }

            Divider()
                .background(Color.theme.border)

            // Ghost Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Ghost")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button("Small") {}
                        .buttonStyle(.ghost(size: .small))

                    Button("Medium") {}
                        .buttonStyle(.ghost)

                    Button("Large") {}
                        .buttonStyle(.ghost(size: .large))
                }
            }

            Divider()
                .background(Color.theme.border)

            // Destructive Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Destructive")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button("Filled") {}
                        .buttonStyle(.destructive)

                    Button("Outlined") {}
                        .buttonStyle(.destructive(variant: .outlined))

                    Button("Ghost") {}
                        .buttonStyle(.destructive(variant: .ghost))
                }
            }

            Divider()
                .background(Color.theme.border)

            // Icon Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Icon Buttons")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button {} label: {
                        Image(systemName: "plus")
                    }
                    .buttonStyle(.icon(variant: .filled))

                    Button {} label: {
                        Image(systemName: "gear")
                    }
                    .buttonStyle(.icon(variant: .outlined))

                    Button {} label: {
                        Image(systemName: "xmark")
                    }
                    .buttonStyle(.icon(variant: .ghost))
                }
            }

            Divider()
                .background(Color.theme.border)

            // Link Buttons
            VStack(alignment: .leading, spacing: 12) {
                Text("Link")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 12) {
                    Button("Learn more") {}
                        .buttonStyle(.link)

                    Button("View details") {}
                        .buttonStyle(.link(color: Color.theme.mutedForeground))
                }
            }
        }
        .padding()
    }
    .background(Color.theme.background)
}
