import SwiftUI

/// A themed error display with optional retry functionality
struct ErrorView: View {
    let title: String
    let message: String
    let retryAction: (() -> Void)?
    let dismissAction: (() -> Void)?

    init(
        title: String = "Something went wrong",
        message: String,
        retryAction: (() -> Void)? = nil,
        dismissAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.retryAction = retryAction
        self.dismissAction = dismissAction
    }

    var body: some View {
        VStack(spacing: .spacing.lg) {
            // Error Icon
            ZStack {
                Circle()
                    .fill(Color.theme.error.opacity(0.15))
                    .frame(width: 72, height: 72)

                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(Color.theme.error)
            }

            // Title and Message
            VStack(spacing: .spacing.sm) {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
                    .multilineTextAlignment(.center)

                Text(message)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
            }

            // Action Buttons
            HStack(spacing: .spacing.md) {
                if let dismissAction = dismissAction {
                    Button(action: dismissAction) {
                        Text("Dismiss")
                            .font(.theme.body)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.mutedForeground)
                            .padding(.horizontal, .spacing.lg)
                            .padding(.vertical, .spacing.md)
                            .background(Color.theme.backgroundSecondary)
                            .cornerRadius(.radius.md)
                    }
                }

                if let retryAction = retryAction {
                    Button(action: retryAction) {
                        HStack(spacing: .spacing.sm) {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 14, weight: .medium))
                            Text("Retry")
                                .font(.theme.body)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(.white)
                        .padding(.horizontal, .spacing.lg)
                        .padding(.vertical, .spacing.md)
                        .background(Color.theme.primary)
                        .cornerRadius(.radius.md)
                    }
                }
            }
        }
        .padding(.spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Inline Error View

/// A compact error display for inline use
struct InlineErrorView: View {
    let message: String
    let retryAction: (() -> Void)?

    init(message: String, retryAction: (() -> Void)? = nil) {
        self.message = message
        self.retryAction = retryAction
    }

    var body: some View {
        HStack(spacing: .spacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(Color.theme.error)
                .font(.system(size: 16))

            Text(message)
                .font(.theme.caption)
                .foregroundColor(Color.theme.error)
                .lineLimit(2)

            Spacer()

            if let retryAction = retryAction {
                Button(action: retryAction) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.theme.primary)
                }
            }
        }
        .padding(.spacing.md)
        .background(Color.theme.error.opacity(0.1))
        .cornerRadius(.radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.error.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Error Banner

/// A dismissible error banner for the top of views
struct ErrorBanner: View {
    let message: String
    let dismissAction: () -> Void

    var body: some View {
        HStack(spacing: .spacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(Color.theme.error)
                .font(.system(size: 18))

            Text(message)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)

            Spacer()

            Button(action: dismissAction) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color.theme.mutedForeground)
                    .padding(.spacing.xs)
            }
        }
        .padding(.spacing.md)
        .background(Color.theme.error.opacity(0.15))
        .overlay(
            Rectangle()
                .fill(Color.theme.error)
                .frame(width: 3),
            alignment: .leading
        )
    }
}

// MARK: - Convenience Initializers

extension ErrorView {
    /// Initialize with an Error object
    init(error: Error, retryAction: (() -> Void)? = nil) {
        self.init(
            title: "Error",
            message: error.localizedDescription,
            retryAction: retryAction
        )
    }
}

// MARK: - Previews

#Preview("Error View") {
    ErrorView(
        title: "Connection Failed",
        message: "Unable to connect to the server. Please check your internet connection and try again.",
        retryAction: { print("Retry tapped") },
        dismissAction: { print("Dismiss tapped") }
    )
}

#Preview("Inline Error") {
    VStack {
        InlineErrorView(
            message: "Failed to load data",
            retryAction: { print("Retry") }
        )
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Error Banner") {
    VStack {
        ErrorBanner(
            message: "Network connection lost",
            dismissAction: { print("Dismissed") }
        )
        Spacer()
    }
    .background(Color.theme.background)
}
