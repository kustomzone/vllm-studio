//
//  Color+Extensions.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

// MARK: - Hex Color Initialization

extension Color {

    /// Initializes a Color from a hex string
    /// - Parameter hex: The hex color string (with or without #)
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

    /// Converts the color to a hex string
    var hexString: String {
        guard let components = UIColor(self).cgColor.components else {
            return "#000000"
        }

        let r = Int((components[0] * 255).rounded())
        let g = Int((components[1] * 255).rounded())
        let b = Int((components[2] * 255).rounded())

        return String(format: "#%02X%02X%02X", r, g, b)
    }
}

// MARK: - Color Adjustments

extension Color {

    /// Returns a lighter version of the color
    /// - Parameter amount: The amount to lighten (0.0 to 1.0)
    func lighter(by amount: CGFloat = 0.2) -> Color {
        adjustBrightness(by: abs(amount))
    }

    /// Returns a darker version of the color
    /// - Parameter amount: The amount to darken (0.0 to 1.0)
    func darker(by amount: CGFloat = 0.2) -> Color {
        adjustBrightness(by: -abs(amount))
    }

    /// Adjusts the brightness of the color
    /// - Parameter amount: The amount to adjust (-1.0 to 1.0)
    private func adjustBrightness(by amount: CGFloat) -> Color {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0

        UIColor(self).getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha)

        let newBrightness = max(0, min(1, brightness + amount))

        return Color(
            hue: Double(hue),
            saturation: Double(saturation),
            brightness: Double(newBrightness),
            opacity: Double(alpha)
        )
    }

    /// Returns a version of the color with modified opacity
    /// - Parameter opacity: The new opacity value (0.0 to 1.0)
    func withOpacity(_ opacity: Double) -> Color {
        self.opacity(opacity)
    }
}

// MARK: - Color Blending

extension Color {

    /// Blends two colors together
    /// - Parameters:
    ///   - other: The color to blend with
    ///   - amount: The blend amount (0.0 = self, 1.0 = other)
    func blended(with other: Color, amount: Double) -> Color {
        let amount = max(0, min(1, amount))

        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0

        UIColor(self).getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        UIColor(other).getRed(&r2, green: &g2, blue: &b2, alpha: &a2)

        return Color(
            red: Double(r1 + (r2 - r1) * CGFloat(amount)),
            green: Double(g1 + (g2 - g1) * CGFloat(amount)),
            blue: Double(b1 + (b2 - b1) * CGFloat(amount)),
            opacity: Double(a1 + (a2 - a1) * CGFloat(amount))
        )
    }
}

// MARK: - Semantic Colors

extension Color {

    /// Returns a contrasting text color (black or white)
    var contrastingTextColor: Color {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0

        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: nil)

        // Calculate luminance
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b

        return luminance > 0.5 ? .black : .white
    }

    /// Whether this color is considered "dark"
    var isDark: Bool {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0

        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: nil)

        let luminance = 0.299 * r + 0.587 * g + 0.114 * b

        return luminance < 0.5
    }
}

// MARK: - Random Color

extension Color {

    /// Generates a random color
    static var random: Color {
        Color(
            red: Double.random(in: 0...1),
            green: Double.random(in: 0...1),
            blue: Double.random(in: 0...1)
        )
    }

    /// Generates a random pastel color
    static var randomPastel: Color {
        Color(
            hue: Double.random(in: 0...1),
            saturation: Double.random(in: 0.2...0.4),
            brightness: Double.random(in: 0.8...0.95)
        )
    }
}
