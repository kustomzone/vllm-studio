//
//  CardModifier.swift
//  vLLMStudio
//
//  Reusable card ViewModifier for consistent card styling
//

import SwiftUI

// MARK: - Card Modifier

/// A reusable ViewModifier that applies card styling to any view
/// Matches the web design system's card component
struct CardModifier: ViewModifier {
    // MARK: - Properties

    /// Background color of the card (default: #171717)
    var backgroundColor: Color

    /// Border color (default: #2d2d2d)
    var borderColor: Color

    /// Corner radius (default: 12pt)
    var cornerRadius: CGFloat

    /// Border width (default: 1pt)
    var borderWidth: CGFloat

    /// Whether to show shadow (default: true)
    var showShadow: Bool

    /// Shadow color
    var shadowColor: Color

    /// Shadow radius
    var shadowRadius: CGFloat

    /// Shadow Y offset
    var shadowY: CGFloat

    /// Padding inside the card
    var padding: EdgeInsets

    // MARK: - Initialization

    init(
        backgroundColor: Color = Color.theme.card,
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        borderWidth: CGFloat = 1,
        showShadow: Bool = true,
        shadowColor: Color = Color.black.opacity(0.4),
        shadowRadius: CGFloat = 8,
        shadowY: CGFloat = 4,
        padding: EdgeInsets = EdgeInsets(
            top: Theme.spacing.cardPadding,
            leading: Theme.spacing.cardPadding,
            bottom: Theme.spacing.cardPadding,
            trailing: Theme.spacing.cardPadding
        )
    ) {
        self.backgroundColor = backgroundColor
        self.borderColor = borderColor
        self.cornerRadius = cornerRadius
        self.borderWidth = borderWidth
        self.showShadow = showShadow
        self.shadowColor = shadowColor
        self.shadowRadius = shadowRadius
        self.shadowY = shadowY
        self.padding = padding
    }

    // MARK: - Body

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
                color: showShadow ? shadowColor : .clear,
                radius: showShadow ? shadowRadius : 0,
                x: 0,
                y: showShadow ? shadowY : 0
            )
    }
}

// MARK: - Pressable Card Modifier

/// Card modifier with press animation support
struct PressableCardModifier: ViewModifier {
    // MARK: - Properties

    var backgroundColor: Color
    var pressedBackgroundColor: Color
    var borderColor: Color
    var pressedBorderColor: Color
    var cornerRadius: CGFloat
    var padding: EdgeInsets
    var scaleOnPress: CGFloat
    var onTap: (() -> Void)?

    @State private var isPressed = false

    // MARK: - Initialization

    init(
        backgroundColor: Color = Color.theme.card,
        pressedBackgroundColor: Color = Color.theme.backgroundTertiary,
        borderColor: Color = Color.theme.border,
        pressedBorderColor: Color = Color.theme.borderLight,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: EdgeInsets = EdgeInsets(
            top: Theme.spacing.cardPadding,
            leading: Theme.spacing.cardPadding,
            bottom: Theme.spacing.cardPadding,
            trailing: Theme.spacing.cardPadding
        ),
        scaleOnPress: CGFloat = 0.98,
        onTap: (() -> Void)? = nil
    ) {
        self.backgroundColor = backgroundColor
        self.pressedBackgroundColor = pressedBackgroundColor
        self.borderColor = borderColor
        self.pressedBorderColor = pressedBorderColor
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.scaleOnPress = scaleOnPress
        self.onTap = onTap
    }

    // MARK: - Body

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(isPressed ? pressedBackgroundColor : backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(isPressed ? pressedBorderColor : borderColor, lineWidth: 1)
            )
            .scaleEffect(isPressed ? scaleOnPress : 1.0)
            .animation(Theme.animation.fast, value: isPressed)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressed {
                            isPressed = true
                        }
                    }
                    .onEnded { _ in
                        isPressed = false
                        onTap?()
                    }
            )
    }
}

// MARK: - Selectable Card Modifier

/// Card modifier with selection state
struct SelectableCardModifier: ViewModifier {
    // MARK: - Properties

    @Binding var isSelected: Bool

    var backgroundColor: Color
    var selectedBackgroundColor: Color
    var borderColor: Color
    var selectedBorderColor: Color
    var cornerRadius: CGFloat
    var padding: EdgeInsets

    // MARK: - Initialization

    init(
        isSelected: Binding<Bool>,
        backgroundColor: Color = Color.theme.card,
        selectedBackgroundColor: Color = Color.theme.primaryMuted,
        borderColor: Color = Color.theme.border,
        selectedBorderColor: Color = Color.theme.primary,
        cornerRadius: CGFloat = Theme.radius.card,
        padding: EdgeInsets = EdgeInsets(
            top: Theme.spacing.cardPadding,
            leading: Theme.spacing.cardPadding,
            bottom: Theme.spacing.cardPadding,
            trailing: Theme.spacing.cardPadding
        )
    ) {
        self._isSelected = isSelected
        self.backgroundColor = backgroundColor
        self.selectedBackgroundColor = selectedBackgroundColor
        self.borderColor = borderColor
        self.selectedBorderColor = selectedBorderColor
        self.cornerRadius = cornerRadius
        self.padding = padding
    }

    // MARK: - Body

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(isSelected ? selectedBackgroundColor : backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(isSelected ? selectedBorderColor : borderColor, lineWidth: isSelected ? 2 : 1)
            )
            .animation(Theme.animation.fast, value: isSelected)
    }
}

// MARK: - View Extensions

extension View {
    /// Apply card modifier with default settings
    func card() -> some View {
        modifier(CardModifier())
    }

    /// Apply card modifier with custom settings
    func card(
        backgroundColor: Color = Color.theme.card,
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        borderWidth: CGFloat = 1,
        showShadow: Bool = true,
        padding: EdgeInsets = EdgeInsets(
            top: Theme.spacing.cardPadding,
            leading: Theme.spacing.cardPadding,
            bottom: Theme.spacing.cardPadding,
            trailing: Theme.spacing.cardPadding
        )
    ) -> some View {
        modifier(CardModifier(
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            cornerRadius: cornerRadius,
            borderWidth: borderWidth,
            showShadow: showShadow,
            padding: padding
        ))
    }

    /// Apply card modifier with uniform padding
    func card(
        backgroundColor: Color = Color.theme.card,
        borderColor: Color = Color.theme.border,
        cornerRadius: CGFloat = Theme.radius.card,
        showShadow: Bool = true,
        padding: CGFloat
    ) -> some View {
        modifier(CardModifier(
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            cornerRadius: cornerRadius,
            showShadow: showShadow,
            padding: EdgeInsets(top: padding, leading: padding, bottom: padding, trailing: padding)
        ))
    }

    /// Apply pressable card modifier
    func pressableCard(
        backgroundColor: Color = Color.theme.card,
        cornerRadius: CGFloat = Theme.radius.card,
        scaleOnPress: CGFloat = 0.98,
        onTap: (() -> Void)? = nil
    ) -> some View {
        modifier(PressableCardModifier(
            backgroundColor: backgroundColor,
            cornerRadius: cornerRadius,
            scaleOnPress: scaleOnPress,
            onTap: onTap
        ))
    }

    /// Apply selectable card modifier
    func selectableCard(
        isSelected: Binding<Bool>,
        selectedBorderColor: Color = Color.theme.primary
    ) -> some View {
        modifier(SelectableCardModifier(
            isSelected: isSelected,
            selectedBorderColor: selectedBorderColor
        ))
    }
}

// MARK: - Preview Provider

#Preview("Card Modifiers") {
    ScrollView {
        VStack(spacing: 20) {
            // Default Card
            Text("Default Card")
                .frame(maxWidth: .infinity)
                .card()

            // Custom Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Custom Card")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)
                Text("With custom colors and no shadow")
                    .font(.theme.caption)
                    .foregroundColor(.theme.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .card(
                backgroundColor: Color.theme.backgroundSecondary,
                showShadow: false,
                padding: 20
            )

            // Pressable Card
            VStack(alignment: .leading, spacing: 8) {
                Text("Pressable Card")
                    .font(.theme.headline)
                    .foregroundColor(.theme.foreground)
                Text("Tap me!")
                    .font(.theme.caption)
                    .foregroundColor(.theme.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .pressableCard {
                print("Card tapped!")
            }

            // Selectable Cards
            SelectableCardDemo()
        }
        .padding()
    }
    .background(Color.theme.background)
}

private struct SelectableCardDemo: View {
    @State private var selectedIndex: Int? = 0

    var body: some View {
        VStack(spacing: 12) {
            Text("Selectable Cards")
                .font(.theme.headline)
                .foregroundColor(.theme.foreground)

            ForEach(0..<3) { index in
                HStack {
                    Text("Option \(index + 1)")
                        .font(.theme.body)
                        .foregroundColor(.theme.foreground)
                    Spacer()
                    if selectedIndex == index {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.theme.primary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .selectableCard(isSelected: .constant(selectedIndex == index))
                .onTapGesture {
                    selectedIndex = index
                }
            }
        }
    }
}
