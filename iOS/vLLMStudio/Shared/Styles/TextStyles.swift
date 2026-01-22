//
//  TextStyles.swift
//  vLLMStudio
//
//  Text style modifiers matching the web design system
//

import SwiftUI

// MARK: - Title Text Style

/// Large title style - main page headers
struct TitleTextStyle: ViewModifier {
    var color: Color = Color.theme.foreground

    func body(content: Content) -> some View {
        content
            .font(.theme.title)
            .foregroundColor(color)
    }
}

// MARK: - Title 2 Text Style

/// Secondary title style - section headers
struct Title2TextStyle: ViewModifier {
    var color: Color = Color.theme.foreground

    func body(content: Content) -> some View {
        content
            .font(.theme.title2)
            .foregroundColor(color)
    }
}

// MARK: - Title 3 Text Style

/// Tertiary title style - subsection headers
struct Title3TextStyle: ViewModifier {
    var color: Color = Color.theme.foreground

    func body(content: Content) -> some View {
        content
            .font(.theme.title3)
            .foregroundColor(color)
    }
}

// MARK: - Headline Text Style

/// Headline style - emphasized text
struct HeadlineTextStyle: ViewModifier {
    var color: Color = Color.theme.foreground

    func body(content: Content) -> some View {
        content
            .font(.theme.headline)
            .foregroundColor(color)
    }
}

// MARK: - Subheadline Text Style

/// Subheadline style - secondary emphasis
struct SubheadlineTextStyle: ViewModifier {
    var color: Color = Color.theme.mutedForeground

    func body(content: Content) -> some View {
        content
            .font(.theme.subheadline)
            .foregroundColor(color)
    }
}

// MARK: - Body Text Style

/// Body style - main content text
struct BodyTextStyle: ViewModifier {
    var color: Color = Color.theme.foreground
    var weight: Font.Weight = .regular

    func body(content: Content) -> some View {
        content
            .font(weight == .regular ? .theme.body : .theme.bodyBold)
            .foregroundColor(color)
    }
}

// MARK: - Callout Text Style

/// Callout style - supporting content
struct CalloutTextStyle: ViewModifier {
    var color: Color = Color.theme.mutedForeground

    func body(content: Content) -> some View {
        content
            .font(.theme.callout)
            .foregroundColor(color)
    }
}

// MARK: - Caption Text Style

/// Caption style - metadata, timestamps
struct CaptionTextStyle: ViewModifier {
    var color: Color = Color.theme.mutedForeground
    var isBold: Bool = false

    func body(content: Content) -> some View {
        content
            .font(isBold ? .theme.captionBold : .theme.caption)
            .foregroundColor(color)
    }
}

// MARK: - Caption 2 Text Style

/// Caption 2 style - smallest text
struct Caption2TextStyle: ViewModifier {
    var color: Color = Color.theme.mutedForeground

    func body(content: Content) -> some View {
        content
            .font(.theme.caption2)
            .foregroundColor(color)
    }
}

// MARK: - Code Text Style

/// Code style - monospaced for code snippets
struct CodeTextStyle: ViewModifier {
    var color: Color = Color.theme.foreground
    var size: CodeSize = .regular
    var showBackground: Bool = false

    enum CodeSize {
        case small
        case regular
        case large
    }

    func body(content: Content) -> some View {
        content
            .font(font)
            .foregroundColor(color)
            .padding(.horizontal, showBackground ? 6 : 0)
            .padding(.vertical, showBackground ? 2 : 0)
            .background(
                showBackground
                    ? RoundedRectangle(cornerRadius: Theme.radius.sm)
                        .fill(Color.theme.codeBackground)
                    : nil
            )
    }

    private var font: Font {
        switch size {
        case .small:
            return .theme.codeSmall
        case .regular:
            return .theme.code
        case .large:
            return .theme.codeLarge
        }
    }
}

// MARK: - Label Text Style

/// Label style - form labels, field names
struct LabelTextStyle: ViewModifier {
    var color: Color = Color.theme.mutedForeground
    var isRequired: Bool = false

    func body(content: Content) -> some View {
        HStack(spacing: 2) {
            content
                .font(.theme.label)
                .foregroundColor(color)

            if isRequired {
                Text("*")
                    .font(.theme.label)
                    .foregroundColor(Color.theme.error)
            }
        }
    }
}

// MARK: - Badge Text Style

/// Badge style - status indicators, counts
struct BadgeTextStyle: ViewModifier {
    var backgroundColor: Color = Color.theme.primary
    var foregroundColor: Color = .white

    func body(content: Content) -> some View {
        content
            .font(.theme.badge)
            .foregroundColor(foregroundColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: Theme.radius.badge)
                    .fill(backgroundColor)
            )
    }
}

// MARK: - Link Text Style

/// Link style - tappable text links
struct LinkTextStyle: ViewModifier {
    var color: Color = Color.theme.link
    var isUnderlined: Bool = false

    func body(content: Content) -> some View {
        content
            .font(.theme.body)
            .foregroundColor(color)
            .underline(isUnderlined)
    }
}

// MARK: - Error Text Style

/// Error style - validation messages
struct ErrorTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.theme.caption)
            .foregroundColor(Color.theme.error)
    }
}

// MARK: - Success Text Style

/// Success style - confirmation messages
struct SuccessTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.theme.caption)
            .foregroundColor(Color.theme.success)
    }
}

// MARK: - Warning Text Style

/// Warning style - caution messages
struct WarningTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.theme.caption)
            .foregroundColor(Color.theme.warning)
    }
}

// MARK: - Muted Text Style

/// Muted style - de-emphasized text
struct MutedTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.theme.body)
            .foregroundColor(Color.theme.mutedForeground)
    }
}

// MARK: - View Extensions

extension View {
    /// Apply title text style
    func titleStyle(color: Color = Color.theme.foreground) -> some View {
        modifier(TitleTextStyle(color: color))
    }

    /// Apply title 2 text style
    func title2Style(color: Color = Color.theme.foreground) -> some View {
        modifier(Title2TextStyle(color: color))
    }

    /// Apply title 3 text style
    func title3Style(color: Color = Color.theme.foreground) -> some View {
        modifier(Title3TextStyle(color: color))
    }

    /// Apply headline text style
    func headlineStyle(color: Color = Color.theme.foreground) -> some View {
        modifier(HeadlineTextStyle(color: color))
    }

    /// Apply subheadline text style
    func subheadlineStyle(color: Color = Color.theme.mutedForeground) -> some View {
        modifier(SubheadlineTextStyle(color: color))
    }

    /// Apply body text style
    func bodyStyle(color: Color = Color.theme.foreground, weight: Font.Weight = .regular) -> some View {
        modifier(BodyTextStyle(color: color, weight: weight))
    }

    /// Apply callout text style
    func calloutStyle(color: Color = Color.theme.mutedForeground) -> some View {
        modifier(CalloutTextStyle(color: color))
    }

    /// Apply caption text style
    func captionStyle(color: Color = Color.theme.mutedForeground, isBold: Bool = false) -> some View {
        modifier(CaptionTextStyle(color: color, isBold: isBold))
    }

    /// Apply caption 2 text style
    func caption2Style(color: Color = Color.theme.mutedForeground) -> some View {
        modifier(Caption2TextStyle(color: color))
    }

    /// Apply code text style
    func codeStyle(
        color: Color = Color.theme.foreground,
        size: CodeTextStyle.CodeSize = .regular,
        showBackground: Bool = false
    ) -> some View {
        modifier(CodeTextStyle(color: color, size: size, showBackground: showBackground))
    }

    /// Apply label text style
    func labelStyle(color: Color = Color.theme.mutedForeground, isRequired: Bool = false) -> some View {
        modifier(LabelTextStyle(color: color, isRequired: isRequired))
    }

    /// Apply badge text style
    func badgeStyle(
        backgroundColor: Color = Color.theme.primary,
        foregroundColor: Color = .white
    ) -> some View {
        modifier(BadgeTextStyle(backgroundColor: backgroundColor, foregroundColor: foregroundColor))
    }

    /// Apply link text style
    func linkStyle(color: Color = Color.theme.link, isUnderlined: Bool = false) -> some View {
        modifier(LinkTextStyle(color: color, isUnderlined: isUnderlined))
    }

    /// Apply error text style
    func errorStyle() -> some View {
        modifier(ErrorTextStyle())
    }

    /// Apply success text style
    func successStyle() -> some View {
        modifier(SuccessTextStyle())
    }

    /// Apply warning text style
    func warningStyle() -> some View {
        modifier(WarningTextStyle())
    }

    /// Apply muted text style
    func mutedStyle() -> some View {
        modifier(MutedTextStyle())
    }
}

// MARK: - Preview Provider

#Preview("Text Styles") {
    ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                Text("Title Style")
                    .titleStyle()

                Text("Title 2 Style")
                    .title2Style()

                Text("Title 3 Style")
                    .title3Style()

                Text("Headline Style")
                    .headlineStyle()

                Text("Subheadline Style")
                    .subheadlineStyle()
            }

            Divider()
                .background(Color.theme.border)

            Group {
                Text("Body Style")
                    .bodyStyle()

                Text("Body Bold Style")
                    .bodyStyle(weight: .semibold)

                Text("Callout Style")
                    .calloutStyle()

                Text("Caption Style")
                    .captionStyle()

                Text("Caption Bold Style")
                    .captionStyle(isBold: true)

                Text("Caption 2 Style")
                    .caption2Style()
            }

            Divider()
                .background(Color.theme.border)

            Group {
                Text("const code = 'inline'")
                    .codeStyle()

                Text("const code = 'with background'")
                    .codeStyle(showBackground: true)

                Text("Field Label")
                    .labelStyle()

                Text("Required Field")
                    .labelStyle(isRequired: true)
            }

            Divider()
                .background(Color.theme.border)

            Group {
                Text("New")
                    .badgeStyle()

                Text("Warning")
                    .badgeStyle(backgroundColor: Color.theme.warning)

                Text("Error")
                    .badgeStyle(backgroundColor: Color.theme.error)

                Text("Success")
                    .badgeStyle(backgroundColor: Color.theme.success)
            }

            Divider()
                .background(Color.theme.border)

            Group {
                Text("Link text")
                    .linkStyle()

                Text("Error message")
                    .errorStyle()

                Text("Success message")
                    .successStyle()

                Text("Warning message")
                    .warningStyle()

                Text("Muted text for less emphasis")
                    .mutedStyle()
            }
        }
        .padding()
    }
    .background(Color.theme.background)
}
