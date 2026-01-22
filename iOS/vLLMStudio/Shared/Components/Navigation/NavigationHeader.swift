import SwiftUI

/// A custom navigation header matching the web app's header styling
struct NavigationHeader<LeadingContent: View, TrailingContent: View>: View {
    let title: String
    let subtitle: String?
    let leadingContent: LeadingContent
    let trailingContent: TrailingContent

    init(
        title: String,
        subtitle: String? = nil,
        @ViewBuilder leading: () -> LeadingContent = { EmptyView() },
        @ViewBuilder trailing: () -> TrailingContent = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.leadingContent = leading()
        self.trailingContent = trailing()
    }

    var body: some View {
        HStack(spacing: .spacing.md) {
            leadingContent

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                }
            }

            Spacer()

            trailingContent
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
        .overlay(
            Rectangle()
                .fill(Color.theme.border)
                .frame(height: 1),
            alignment: .bottom
        )
    }
}

// MARK: - Header with Back Button

/// A navigation header with a back button
struct NavigationHeaderWithBack<TrailingContent: View>: View {
    let title: String
    let subtitle: String?
    let onBack: () -> Void
    let trailingContent: TrailingContent

    init(
        title: String,
        subtitle: String? = nil,
        onBack: @escaping () -> Void,
        @ViewBuilder trailing: () -> TrailingContent = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.onBack = onBack
        self.trailingContent = trailing()
    }

    var body: some View {
        NavigationHeader(
            title: title,
            subtitle: subtitle,
            leading: {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(Color.theme.primary)
                }
            },
            trailing: {
                trailingContent
            }
        )
    }
}

// MARK: - Large Title Header

/// A navigation header with a large title style
struct LargeTitleHeader<TrailingContent: View>: View {
    let title: String
    let subtitle: String?
    let trailingContent: TrailingContent

    init(
        title: String,
        subtitle: String? = nil,
        @ViewBuilder trailing: () -> TrailingContent = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.trailingContent = trailing()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            HStack {
                VStack(alignment: .leading, spacing: .spacing.xs) {
                    Text(title)
                        .font(.theme.largeTitle)
                        .foregroundColor(Color.theme.foreground)

                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.theme.body)
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }

                Spacer()

                trailingContent
            }
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.lg)
        .background(Color.theme.background)
    }
}

// MARK: - Search Header

/// A navigation header with an integrated search field
struct SearchHeader: View {
    let title: String
    @Binding var searchText: String
    var placeholder: String
    var onCancel: (() -> Void)?

    @State private var isSearching: Bool = false

    var body: some View {
        VStack(spacing: .spacing.md) {
            if !isSearching {
                HStack {
                    Text(title)
                        .font(.theme.headline)
                        .foregroundColor(Color.theme.foreground)

                    Spacer()

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isSearching = true
                        }
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 18))
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }

            if isSearching {
                HStack(spacing: .spacing.md) {
                    HStack(spacing: .spacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 16))
                            .foregroundColor(Color.theme.mutedForeground)

                        TextField(placeholder, text: $searchText)
                            .font(.theme.body)
                            .foregroundColor(Color.theme.foreground)
                            .autocorrectionDisabled()

                        if !searchText.isEmpty {
                            Button {
                                searchText = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(Color.theme.mutedForeground)
                            }
                        }
                    }
                    .padding(.spacing.sm)
                    .background(Color.theme.card)
                    .cornerRadius(.radius.md)

                    Button("Cancel") {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isSearching = false
                            searchText = ""
                            onCancel?()
                        }
                    }
                    .font(.theme.body)
                    .foregroundColor(Color.theme.primary)
                }
            }
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
        .overlay(
            Rectangle()
                .fill(Color.theme.border)
                .frame(height: 1),
            alignment: .bottom
        )
    }
}

// MARK: - Segmented Header

/// A navigation header with segmented control
struct SegmentedHeader<Content: View>: View {
    let title: String
    @Binding var selectedSegment: Int
    let segments: [String]
    let trailingContent: Content

    init(
        title: String,
        selectedSegment: Binding<Int>,
        segments: [String],
        @ViewBuilder trailing: () -> Content = { EmptyView() }
    ) {
        self.title = title
        self._selectedSegment = selectedSegment
        self.segments = segments
        self.trailingContent = trailing()
    }

    var body: some View {
        VStack(spacing: .spacing.md) {
            HStack {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Spacer()

                trailingContent
            }

            // Custom segmented control
            HStack(spacing: 0) {
                ForEach(segments.indices, id: \.self) { index in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedSegment = index
                        }
                    } label: {
                        Text(segments[index])
                            .font(.theme.caption)
                            .fontWeight(selectedSegment == index ? .medium : .regular)
                            .foregroundColor(
                                selectedSegment == index ?
                                Color.theme.foreground :
                                Color.theme.mutedForeground
                            )
                            .padding(.horizontal, .spacing.md)
                            .padding(.vertical, .spacing.sm)
                            .background(
                                selectedSegment == index ?
                                Color.theme.card :
                                Color.clear
                            )
                            .cornerRadius(.radius.sm)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.spacing.xs)
            .background(Color.theme.backgroundTertiary)
            .cornerRadius(.radius.md)
        }
        .padding(.horizontal, .spacing.lg)
        .padding(.vertical, .spacing.md)
        .background(Color.theme.backgroundSecondary)
        .overlay(
            Rectangle()
                .fill(Color.theme.border)
                .frame(height: 1),
            alignment: .bottom
        )
    }
}

// MARK: - Header Button Styles

struct HeaderButton: View {
    let icon: String
    let action: () -> Void
    var badge: Int?

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(Color.theme.mutedForeground)
                    .frame(width: 36, height: 36)
                    .background(Color.theme.card)
                    .cornerRadius(.radius.md)

                if let badge = badge, badge > 0 {
                    Text(badge > 99 ? "99+" : "\(badge)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.theme.error)
                        .clipShape(Capsule())
                        .offset(x: 4, y: -4)
                }
            }
        }
    }
}

// MARK: - Previews

#Preview("Navigation Header") {
    VStack(spacing: 0) {
        NavigationHeader(
            title: "Dashboard",
            subtitle: "System Overview",
            leading: {
                Image(systemName: "square.grid.2x2.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color.theme.primary)
            },
            trailing: {
                HeaderButton(icon: "bell", badge: 3) {}
            }
        )

        Spacer()
    }
    .background(Color.theme.background)
}

#Preview("Header with Back") {
    VStack(spacing: 0) {
        NavigationHeaderWithBack(
            title: "Recipe Details",
            subtitle: "llama-3.1-70b",
            onBack: {}
        ) {
            HeaderButton(icon: "ellipsis") {}
        }

        Spacer()
    }
    .background(Color.theme.background)
}

#Preview("Large Title Header") {
    VStack(spacing: 0) {
        LargeTitleHeader(
            title: "Chat",
            subtitle: "Start a conversation"
        ) {
            Button {
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.theme.primary)
                    .cornerRadius(.radius.md)
            }
        }

        Spacer()
    }
    .background(Color.theme.background)
}

#Preview("Search Header") {
    struct PreviewWrapper: View {
        @State private var searchText = ""

        var body: some View {
            VStack(spacing: 0) {
                SearchHeader(
                    title: "Discover",
                    searchText: $searchText,
                    placeholder: "Search models..."
                )

                Spacer()
            }
            .background(Color.theme.background)
        }
    }

    return PreviewWrapper()
}

#Preview("Segmented Header") {
    struct PreviewWrapper: View {
        @State private var selectedSegment = 0

        var body: some View {
            VStack(spacing: 0) {
                SegmentedHeader(
                    title: "Usage",
                    selectedSegment: $selectedSegment,
                    segments: ["Day", "Week", "Month"]
                )

                Spacer()
            }
            .background(Color.theme.background)
        }
    }

    return PreviewWrapper()
}
