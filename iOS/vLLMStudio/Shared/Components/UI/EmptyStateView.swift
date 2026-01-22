import SwiftUI

/// A themed empty state display with optional action button
struct EmptyStateView: View {
    let icon: String
    let title: String
    let description: String
    let actionTitle: String?
    let action: (() -> Void)?

    init(
        icon: String,
        title: String,
        description: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.description = description
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        VStack(spacing: .spacing.lg) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color.theme.backgroundSecondary)
                    .frame(width: 80, height: 80)

                Image(systemName: icon)
                    .font(.system(size: 36))
                    .foregroundColor(Color.theme.mutedForeground)
            }

            // Title and Description
            VStack(spacing: .spacing.sm) {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
                    .multilineTextAlignment(.center)

                Text(description)
                    .font(.theme.body)
                    .foregroundColor(Color.theme.mutedForeground)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            .padding(.horizontal, .spacing.xl)

            // Action Button
            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .medium))
                        Text(actionTitle)
                            .font(.theme.body)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, .spacing.xl)
                    .padding(.vertical, .spacing.md)
                    .background(Color.theme.primary)
                    .cornerRadius(.radius.md)
                }
                .padding(.top, .spacing.sm)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Preset Empty States

extension EmptyStateView {
    /// Empty state for no chat sessions
    static func noChats(action: @escaping () -> Void) -> EmptyStateView {
        EmptyStateView(
            icon: "bubble.left.and.bubble.right",
            title: "No Conversations",
            description: "Start a new conversation to begin chatting with your AI assistant.",
            actionTitle: "New Chat",
            action: action
        )
    }

    /// Empty state for no recipes
    static func noRecipes(action: @escaping () -> Void) -> EmptyStateView {
        EmptyStateView(
            icon: "doc.text",
            title: "No Recipes",
            description: "Create a recipe to configure how your model runs.",
            actionTitle: "Create Recipe",
            action: action
        )
    }

    /// Empty state for no logs
    static var noLogs: EmptyStateView {
        EmptyStateView(
            icon: "doc.text.magnifyingglass",
            title: "No Logs",
            description: "Log entries will appear here when the model is running."
        )
    }

    /// Empty state for no search results
    static func noResults(query: String) -> EmptyStateView {
        EmptyStateView(
            icon: "magnifyingglass",
            title: "No Results",
            description: "No results found for \"\(query)\". Try a different search term."
        )
    }

    /// Empty state for no models discovered
    static func noModels(action: @escaping () -> Void) -> EmptyStateView {
        EmptyStateView(
            icon: "cpu",
            title: "No Models Found",
            description: "Browse available models to find one that fits your needs.",
            actionTitle: "Browse Models",
            action: action
        )
    }

    /// Empty state for offline/disconnected
    static func offline(action: @escaping () -> Void) -> EmptyStateView {
        EmptyStateView(
            icon: "wifi.slash",
            title: "No Connection",
            description: "Unable to connect to the server. Check your network settings.",
            actionTitle: "Retry",
            action: action
        )
    }
}

// MARK: - Compact Empty State

/// A smaller empty state for use in cards or sections
struct CompactEmptyStateView: View {
    let icon: String
    let message: String

    var body: some View {
        VStack(spacing: .spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundColor(Color.theme.mutedForeground)

            Text(message)
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)
                .multilineTextAlignment(.center)
        }
        .padding(.spacing.lg)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Previews

#Preview("Empty State with Action") {
    EmptyStateView(
        icon: "bubble.left.and.bubble.right",
        title: "No Conversations",
        description: "Start a new conversation to begin chatting with your AI assistant.",
        actionTitle: "New Chat",
        action: { print("New chat tapped") }
    )
}

#Preview("Empty State without Action") {
    EmptyStateView.noLogs
}

#Preview("Compact Empty State") {
    CompactEmptyStateView(icon: "tray", message: "No items")
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .padding()
        .background(Color.theme.background)
}
