//
//  Theme.swift
//  vLLMStudio
//
//  Complete design system theme matching the web dark theme
//

import SwiftUI

// MARK: - Color Hex Initializer Extension

extension Color {
    /// Initialize a Color from a hex string (e.g., "#0d0d0d" or "0d0d0d")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    /// Returns the hex string representation of the color
    var hexString: String {
        guard let components = UIColor(self).cgColor.components, components.count >= 3 else {
            return "#000000"
        }

        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)

        return String(format: "#%02X%02X%02X", r, g, b)
    }

    /// Lighten the color by a percentage (0-1)
    func lighter(by percentage: CGFloat = 0.1) -> Color {
        return self.adjust(by: abs(percentage))
    }

    /// Darken the color by a percentage (0-1)
    func darker(by percentage: CGFloat = 0.1) -> Color {
        return self.adjust(by: -abs(percentage))
    }

    private func adjust(by percentage: CGFloat) -> Color {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        UIColor(self).getRed(&red, green: &green, blue: &blue, alpha: &alpha)

        return Color(
            red: min(max(red + percentage, 0), 1),
            green: min(max(green + percentage, 0), 1),
            blue: min(max(blue + percentage, 0), 1),
            opacity: alpha
        )
    }
}

// MARK: - Theme Colors

/// Complete color palette matching the web dark theme
struct ThemeColors {
    // MARK: - Backgrounds

    /// Primary background color - #0d0d0d
    let background = Color(hex: "#0d0d0d")

    /// Secondary background for sections - #1b1b1b
    let backgroundSecondary = Color(hex: "#1b1b1b")

    /// Tertiary background for nested elements - #1f1f1f
    let backgroundTertiary = Color(hex: "#1f1f1f")

    /// Card background - #171717
    let card = Color(hex: "#171717")

    // MARK: - Text Colors

    /// Primary text color - #e8e6e3
    let foreground = Color(hex: "#e8e6e3")

    /// Muted/secondary text - #9a9088
    let mutedForeground = Color(hex: "#9a9088")

    /// Placeholder text color
    let placeholder = Color(hex: "#6b6b6b")

    // MARK: - Accent Colors

    /// Primary accent (orange) - #d97706
    let primary = Color(hex: "#d97706")

    /// Primary hover state - #ea580c
    let primaryHover = Color(hex: "#ea580c")

    /// Primary muted for backgrounds
    let primaryMuted = Color(hex: "#d97706").opacity(0.15)

    // MARK: - Status Colors

    /// Success state (green) - #15803d
    let success = Color(hex: "#15803d")

    /// Success background
    let successMuted = Color(hex: "#15803d").opacity(0.15)

    /// Error state (red) - #dc2626
    let error = Color(hex: "#dc2626")

    /// Error background
    let errorMuted = Color(hex: "#dc2626").opacity(0.15)

    /// Warning state (orange) - #d97706
    let warning = Color(hex: "#d97706")

    /// Warning background
    let warningMuted = Color(hex: "#d97706").opacity(0.15)

    /// Info state (blue) - #2563eb
    let info = Color(hex: "#2563eb")

    /// Info background
    let infoMuted = Color(hex: "#2563eb").opacity(0.15)

    // MARK: - Border Colors

    /// Default border color - #2d2d2d
    let border = Color(hex: "#2d2d2d")

    /// Lighter border for hover states - #3d3d3d
    let borderLight = Color(hex: "#3d3d3d")

    /// Focus border color
    let borderFocus = Color(hex: "#d97706")

    // MARK: - Additional UI Colors

    /// Input field background
    let inputBackground = Color(hex: "#1b1b1b")

    /// Overlay background (for modals, sheets)
    let overlay = Color(hex: "#000000").opacity(0.6)

    /// Code block background
    let codeBackground = Color(hex: "#1a1a1a")

    /// Selection/highlight color
    let selection = Color(hex: "#d97706").opacity(0.2)

    /// Disabled state color
    let disabled = Color(hex: "#4a4a4a")

    /// Disabled text color
    let disabledForeground = Color(hex: "#6b6b6b")

    /// Link color
    let link = Color(hex: "#d97706")

    /// Divider color
    let divider = Color(hex: "#2d2d2d")

    /// Shimmer base color
    let shimmerBase = Color(hex: "#2d2d2d")

    /// Shimmer highlight color
    let shimmerHighlight = Color(hex: "#3d3d3d")
}

// MARK: - Theme Fonts

/// Typography system matching Geist font characteristics
struct ThemeFonts {
    // MARK: - Display Fonts

    /// Large title - 28pt bold
    let largeTitle = Font.system(size: 28, weight: .bold, design: .default)

    /// Title - 24pt semibold
    let title = Font.system(size: 24, weight: .semibold, design: .default)

    /// Title 2 - 20pt semibold
    let title2 = Font.system(size: 20, weight: .semibold, design: .default)

    /// Title 3 - 18pt semibold
    let title3 = Font.system(size: 18, weight: .semibold, design: .default)

    // MARK: - Text Fonts

    /// Headline - 18pt semibold
    let headline = Font.system(size: 18, weight: .semibold, design: .default)

    /// Subheadline - 15pt medium
    let subheadline = Font.system(size: 15, weight: .medium, design: .default)

    /// Body - 14pt regular
    let body = Font.system(size: 14, weight: .regular, design: .default)

    /// Body bold - 14pt semibold
    let bodyBold = Font.system(size: 14, weight: .semibold, design: .default)

    /// Body large - 16pt regular
    let bodyLarge = Font.system(size: 16, weight: .regular, design: .default)

    /// Callout - 13pt regular
    let callout = Font.system(size: 13, weight: .regular, design: .default)

    /// Caption - 12pt regular
    let caption = Font.system(size: 12, weight: .regular, design: .default)

    /// Caption bold - 12pt semibold
    let captionBold = Font.system(size: 12, weight: .semibold, design: .default)

    /// Caption 2 - 11pt regular
    let caption2 = Font.system(size: 11, weight: .regular, design: .default)

    // MARK: - Monospace Fonts

    /// Code - 13pt regular monospaced
    let code = Font.system(size: 13, weight: .regular, design: .monospaced)

    /// Code small - 12pt regular monospaced
    let codeSmall = Font.system(size: 12, weight: .regular, design: .monospaced)

    /// Code large - 14pt regular monospaced
    let codeLarge = Font.system(size: 14, weight: .regular, design: .monospaced)

    // MARK: - Special Fonts

    /// Button text - 14pt medium
    let button = Font.system(size: 14, weight: .medium, design: .default)

    /// Button small text - 12pt medium
    let buttonSmall = Font.system(size: 12, weight: .medium, design: .default)

    /// Button large text - 16pt medium
    let buttonLarge = Font.system(size: 16, weight: .medium, design: .default)

    /// Tab bar - 10pt medium
    let tabBar = Font.system(size: 10, weight: .medium, design: .default)

    /// Badge - 11pt semibold
    let badge = Font.system(size: 11, weight: .semibold, design: .default)

    /// Label - 13pt medium
    let label = Font.system(size: 13, weight: .medium, design: .default)
}

// MARK: - Theme Spacing

/// Consistent spacing values for layout
struct ThemeSpacing {
    /// Extra extra small - 2pt
    let xxs: CGFloat = 2

    /// Extra small - 4pt
    let xs: CGFloat = 4

    /// Small - 8pt
    let sm: CGFloat = 8

    /// Medium - 12pt
    let md: CGFloat = 12

    /// Large - 16pt
    let lg: CGFloat = 16

    /// Extra large - 24pt
    let xl: CGFloat = 24

    /// 2x Extra large - 32pt
    let xxl: CGFloat = 32

    /// 3x Extra large - 48pt
    let xxxl: CGFloat = 48

    /// Card padding - 16pt
    let cardPadding: CGFloat = 16

    /// Section spacing - 24pt
    let sectionSpacing: CGFloat = 24

    /// Screen horizontal padding - 16pt
    let screenHorizontal: CGFloat = 16

    /// Screen vertical padding - 20pt
    let screenVertical: CGFloat = 20
}

// MARK: - Theme Radius

/// Border radius values for consistent corners
struct ThemeRadius {
    /// Extra small - 2pt
    let xs: CGFloat = 2

    /// Small - 4pt
    let sm: CGFloat = 4

    /// Medium - 8pt
    let md: CGFloat = 8

    /// Large - 12pt
    let lg: CGFloat = 12

    /// Extra large - 16pt
    let xl: CGFloat = 16

    /// 2x Extra large - 20pt
    let xxl: CGFloat = 20

    /// Full (pill) - 9999pt
    let full: CGFloat = 9999

    /// Card radius - 12pt
    let card: CGFloat = 12

    /// Button radius - 8pt
    let button: CGFloat = 8

    /// Input radius - 8pt
    let input: CGFloat = 8

    /// Badge radius - 4pt
    let badge: CGFloat = 4

    /// Message bubble radius - 16pt
    let messageBubble: CGFloat = 16
}

// MARK: - Theme Shadows

/// Shadow configurations for depth
struct ThemeShadows {
    /// Small shadow
    var sm: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color.black.opacity(0.15), 2, 0, 1)
    }

    /// Medium shadow
    var md: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color.black.opacity(0.2), 4, 0, 2)
    }

    /// Large shadow
    var lg: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color.black.opacity(0.25), 8, 0, 4)
    }

    /// Extra large shadow
    var xl: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color.black.opacity(0.3), 16, 0, 8)
    }

    /// Card shadow
    var card: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color.black.opacity(0.4), 8, 0, 4)
    }

    /// Glow effect (orange)
    var glow: (color: Color, radius: CGFloat, x: CGFloat, y: CGFloat) {
        (Color(hex: "#d97706").opacity(0.3), 12, 0, 0)
    }
}

// MARK: - Theme Animation

/// Animation durations and curves
struct ThemeAnimation {
    /// Fast animation - 0.15s
    let fast: Animation = .easeOut(duration: 0.15)

    /// Normal animation - 0.25s
    let normal: Animation = .easeInOut(duration: 0.25)

    /// Slow animation - 0.35s
    let slow: Animation = .easeInOut(duration: 0.35)

    /// Extra slow animation - 0.5s
    let extraSlow: Animation = .easeInOut(duration: 0.5)

    /// Spring animation - responsive
    let spring: Animation = .spring(response: 0.3, dampingFraction: 0.7)

    /// Spring animation - bouncy
    let springBouncy: Animation = .spring(response: 0.4, dampingFraction: 0.6)

    /// Spring animation - stiff
    let springStiff: Animation = .spring(response: 0.2, dampingFraction: 0.8)

    /// Shimmer animation duration
    let shimmerDuration: Double = 1.5

    /// Pulse animation duration
    let pulseDuration: Double = 2.0
}

// MARK: - Theme Icon Sizes

/// Icon size values for consistency
struct ThemeIconSize {
    /// Extra small - 12pt
    let xs: CGFloat = 12

    /// Small - 16pt
    let sm: CGFloat = 16

    /// Medium - 20pt
    let md: CGFloat = 20

    /// Large - 24pt
    let lg: CGFloat = 24

    /// Extra large - 32pt
    let xl: CGFloat = 32

    /// 2x Extra large - 48pt
    let xxl: CGFloat = 48
}

// MARK: - Global Theme Access

extension Color {
    /// Access theme colors globally
    static let theme = ThemeColors()
}

extension Font {
    /// Access theme fonts globally
    static let theme = ThemeFonts()
}

extension CGFloat {
    /// Access theme spacing globally
    static let spacing = ThemeSpacing()

    /// Access theme radius globally
    static let radius = ThemeRadius()

    /// Access theme icon sizes globally
    static let iconSize = ThemeIconSize()
}

/// Global theme instance for accessing all theme values
struct Theme {
    static let colors = ThemeColors()
    static let fonts = ThemeFonts()
    static let spacing = ThemeSpacing()
    static let radius = ThemeRadius()
    static let shadows = ThemeShadows()
    static let animation = ThemeAnimation()
    static let iconSize = ThemeIconSize()
}

// MARK: - Preview Provider

#Preview("Theme Colors") {
    ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                Text("Backgrounds")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 8) {
                    colorSwatch("background", Color.theme.background)
                    colorSwatch("secondary", Color.theme.backgroundSecondary)
                    colorSwatch("tertiary", Color.theme.backgroundTertiary)
                    colorSwatch("card", Color.theme.card)
                }
            }

            Group {
                Text("Text")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 8) {
                    colorSwatch("foreground", Color.theme.foreground)
                    colorSwatch("muted", Color.theme.mutedForeground)
                }
            }

            Group {
                Text("Accent")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 8) {
                    colorSwatch("primary", Color.theme.primary)
                    colorSwatch("hover", Color.theme.primaryHover)
                }
            }

            Group {
                Text("Status")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)

                HStack(spacing: 8) {
                    colorSwatch("success", Color.theme.success)
                    colorSwatch("error", Color.theme.error)
                    colorSwatch("warning", Color.theme.warning)
                }
            }
        }
        .padding()
    }
    .background(Color.theme.background)
}

@ViewBuilder
private func colorSwatch(_ name: String, _ color: Color) -> some View {
    VStack(spacing: 4) {
        RoundedRectangle(cornerRadius: 8)
            .fill(color)
            .frame(width: 60, height: 60)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        Text(name)
            .font(.theme.caption)
            .foregroundColor(.theme.mutedForeground)
    }
}
