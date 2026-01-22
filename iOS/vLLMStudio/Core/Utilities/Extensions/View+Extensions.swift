//
//  View+Extensions.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

// MARK: - Conditional Modifiers

extension View {

    /// Applies a modifier conditionally
    /// - Parameters:
    ///   - condition: The condition to evaluate
    ///   - transform: The modifier to apply if condition is true
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    /// Applies one of two modifiers based on a condition
    /// - Parameters:
    ///   - condition: The condition to evaluate
    ///   - ifTrue: The modifier to apply if condition is true
    ///   - ifFalse: The modifier to apply if condition is false
    @ViewBuilder
    func `if`<TrueContent: View, FalseContent: View>(
        _ condition: Bool,
        ifTrue: (Self) -> TrueContent,
        ifFalse: (Self) -> FalseContent
    ) -> some View {
        if condition {
            ifTrue(self)
        } else {
            ifFalse(self)
        }
    }

    /// Applies a modifier if a value is non-nil
    /// - Parameters:
    ///   - value: The optional value
    ///   - transform: The modifier to apply with the unwrapped value
    @ViewBuilder
    func ifLet<Value, Content: View>(_ value: Value?, transform: (Self, Value) -> Content) -> some View {
        if let value = value {
            transform(self, value)
        } else {
            self
        }
    }
}

// MARK: - Visibility

extension View {

    /// Hides the view based on a condition
    /// - Parameter hidden: Whether to hide the view
    @ViewBuilder
    func hidden(_ hidden: Bool) -> some View {
        if hidden {
            self.hidden()
        } else {
            self
        }
    }

    /// Makes the view visible or invisible
    /// - Parameter visible: Whether the view should be visible
    @ViewBuilder
    func visible(_ visible: Bool) -> some View {
        self.opacity(visible ? 1 : 0)
    }
}

// MARK: - Frame Helpers

extension View {

    /// Sets both width and height to the same value
    /// - Parameter size: The size for both dimensions
    func frame(size: CGFloat) -> some View {
        self.frame(width: size, height: size)
    }

    /// Expands the view to fill available space
    func expandFrame(alignment: Alignment = .center) -> some View {
        self.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
    }

    /// Expands the view horizontally
    func expandWidth(alignment: Alignment = .center) -> some View {
        self.frame(maxWidth: .infinity, alignment: alignment)
    }

    /// Expands the view vertically
    func expandHeight(alignment: Alignment = .center) -> some View {
        self.frame(maxHeight: .infinity, alignment: alignment)
    }
}

// MARK: - Card Style

extension View {

    /// Applies the standard card style
    func card(padding: CGFloat = Constants.UI.cardPadding) -> some View {
        self
            .padding(padding)
            .background(Color.theme.card)
            .cornerRadius(Constants.UI.cornerRadius)
    }

    /// Applies the standard card style with border
    func borderedCard(padding: CGFloat = Constants.UI.cardPadding) -> some View {
        self
            .padding(padding)
            .background(Color.theme.card)
            .cornerRadius(Constants.UI.cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: Constants.UI.cornerRadius)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
    }
}

// MARK: - Tap & Press

extension View {

    /// Adds a tap gesture with haptic feedback
    func onTapWithHaptic(action: @escaping () -> Void) -> some View {
        self.onTapGesture {
            if UserDefaultsManager.shared.hapticFeedbackEnabled {
                let generator = UIImpactFeedbackGenerator(style: .light)
                generator.impactOccurred()
            }
            action()
        }
    }

    /// Adds a press effect (scales down when pressed)
    func pressEffect(scale: CGFloat = 0.95) -> some View {
        self.buttonStyle(PressEffectButtonStyle(scale: scale))
    }
}

// MARK: - Loading & Error States

extension View {

    /// Overlays a loading indicator
    func loading(_ isLoading: Bool) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Color.black.opacity(0.3)
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(1.2)
                }
            }
        }
    }

    /// Overlays an error message
    func error(_ message: String?, onRetry: (() -> Void)? = nil) -> some View {
        self.overlay {
            if let message = message {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 40))
                        .foregroundColor(Color.theme.error)

                    Text(message)
                        .font(.theme.body)
                        .foregroundColor(Color.theme.foreground)
                        .multilineTextAlignment(.center)

                    if let onRetry = onRetry {
                        Button("Retry") {
                            onRetry()
                        }
                        .buttonStyle(.bordered)
                        .tint(Color.theme.primary)
                    }
                }
                .padding()
                .background(Color.theme.backgroundSecondary)
                .cornerRadius(Constants.UI.cornerRadius)
            }
        }
    }
}

// MARK: - Keyboard

extension View {

    /// Dismisses the keyboard when tapping outside
    func dismissKeyboardOnTap() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
    }
}

// MARK: - Scroll

extension View {

    /// Wraps the view in a ScrollView if needed
    @ViewBuilder
    func scrollableIfNeeded(axis: Axis.Set = .vertical) -> some View {
        ScrollView(axis, showsIndicators: false) {
            self
        }
    }
}

// MARK: - Debug

extension View {

    /// Adds a debug border (only in DEBUG builds)
    func debugBorder(_ color: Color = .red, width: CGFloat = 1) -> some View {
        #if DEBUG
        return self.border(color, width: width)
        #else
        return self
        #endif
    }

    /// Prints a debug message when the view appears
    func debugOnAppear(_ message: String) -> some View {
        #if DEBUG
        return self.onAppear { print("[DEBUG] \(message)") }
        #else
        return self
        #endif
    }
}

// MARK: - Press Effect Button Style

struct PressEffectButtonStyle: ButtonStyle {
    let scale: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}
