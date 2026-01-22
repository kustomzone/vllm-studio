import SwiftUI

/// The main tab selection type
enum AppTab: String, CaseIterable, Identifiable {
    case dashboard
    case chat
    case recipes
    case logs
    case usage
    case configs
    case discover

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .chat: return "Chat"
        case .recipes: return "Recipes"
        case .logs: return "Logs"
        case .usage: return "Usage"
        case .configs: return "Configs"
        case .discover: return "Discover"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .chat: return "bubble.left.and.bubble.right"
        case .recipes: return "doc.text"
        case .logs: return "list.bullet.rectangle"
        case .usage: return "chart.bar"
        case .configs: return "gearshape"
        case .discover: return "magnifyingglass"
        }
    }

    var selectedIcon: String {
        switch self {
        case .dashboard: return "square.grid.2x2.fill"
        case .chat: return "bubble.left.and.bubble.right.fill"
        case .recipes: return "doc.text.fill"
        case .logs: return "list.bullet.rectangle.fill"
        case .usage: return "chart.bar.fill"
        case .configs: return "gearshape.fill"
        case .discover: return "magnifyingglass"
        }
    }

    /// Primary tabs shown in the main tab bar (iPhone)
    static var primaryTabs: [AppTab] {
        [.dashboard, .chat, .recipes, .configs]
    }

    /// All tabs for sidebar (iPad) or "More" menu
    static var allTabs: [AppTab] {
        AppTab.allCases
    }
}

// MARK: - Custom Tab Bar

/// A custom tab bar matching the web app's sidebar styling
struct CustomTabBar: View {
    @Binding var selectedTab: AppTab
    var tabs: [AppTab]

    init(selectedTab: Binding<AppTab>, tabs: [AppTab] = AppTab.primaryTabs) {
        self._selectedTab = selectedTab
        self.tabs = tabs
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in
                TabBarItem(
                    tab: tab,
                    isSelected: selectedTab == tab
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedTab = tab
                    }
                }
            }
        }
        .padding(.horizontal, .spacing.sm)
        .padding(.top, .spacing.sm)
        .padding(.bottom, .spacing.lg)
        .background(Color.theme.backgroundSecondary)
        .overlay(
            Rectangle()
                .fill(Color.theme.border)
                .frame(height: 1),
            alignment: .top
        )
    }
}

// MARK: - Tab Bar Item

struct TabBarItem: View {
    let tab: AppTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: .spacing.xs) {
                Image(systemName: isSelected ? tab.selectedIcon : tab.icon)
                    .font(.system(size: 22))
                    .foregroundColor(isSelected ? Color.theme.primary : Color.theme.mutedForeground)
                    .frame(height: 24)

                Text(tab.title)
                    .font(.theme.caption2)
                    .foregroundColor(isSelected ? Color.theme.primary : Color.theme.mutedForeground)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, .spacing.sm)
            .background(
                isSelected ?
                Color.theme.primary.opacity(0.1) :
                Color.clear
            )
            .cornerRadius(.radius.md)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tab View Container

/// A container view that manages tab-based navigation
struct TabViewContainer<Content: View>: View {
    @Binding var selectedTab: AppTab
    let content: (AppTab) -> Content

    var body: some View {
        ZStack {
            Color.theme.background.ignoresSafeArea()

            content(selectedTab)
        }
        .safeAreaInset(edge: .bottom) {
            CustomTabBar(selectedTab: $selectedTab)
        }
    }
}

// MARK: - More Menu (for additional tabs on iPhone)

/// A "More" menu for accessing additional tabs on iPhone
struct MoreTabView: View {
    @Binding var selectedTab: AppTab
    @Environment(\.dismiss) private var dismiss

    private let additionalTabs: [AppTab] = [.logs, .usage, .discover]

    var body: some View {
        NavigationStack {
            List {
                ForEach(additionalTabs) { tab in
                    Button {
                        selectedTab = tab
                        dismiss()
                    } label: {
                        HStack(spacing: .spacing.md) {
                            Image(systemName: tab.icon)
                                .font(.system(size: 20))
                                .foregroundColor(Color.theme.primary)
                                .frame(width: 28)

                            Text(tab.title)
                                .font(.theme.body)
                                .foregroundColor(Color.theme.foreground)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Color.theme.mutedForeground)
                        }
                        .padding(.vertical, .spacing.sm)
                    }
                    .listRowBackground(Color.theme.card)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.theme.background)
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(Color.theme.primary)
                }
            }
        }
    }
}

// MARK: - Floating Tab Indicator

/// An animated indicator that highlights the selected tab
struct TabIndicator: View {
    let tabCount: Int
    let selectedIndex: Int
    let tabWidth: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Color.theme.primary)
            .frame(width: tabWidth * 0.5, height: 3)
            .offset(x: CGFloat(selectedIndex) * tabWidth + tabWidth * 0.25 - CGFloat(tabCount - 1) * tabWidth / 2)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: selectedIndex)
    }
}

// MARK: - Previews

#Preview("Custom Tab Bar") {
    struct PreviewWrapper: View {
        @State private var selectedTab: AppTab = .dashboard

        var body: some View {
            VStack {
                Spacer()
                Text("Selected: \(selectedTab.title)")
                    .foregroundColor(Color.theme.foreground)
                Spacer()
                CustomTabBar(selectedTab: $selectedTab)
            }
            .background(Color.theme.background)
        }
    }

    return PreviewWrapper()
}

#Preview("Tab Bar Item") {
    HStack(spacing: 20) {
        TabBarItem(tab: .dashboard, isSelected: true) {}
        TabBarItem(tab: .chat, isSelected: false) {}
        TabBarItem(tab: .recipes, isSelected: false) {}
    }
    .padding()
    .background(Color.theme.backgroundSecondary)
}

#Preview("More Tab View") {
    struct PreviewWrapper: View {
        @State private var selectedTab: AppTab = .dashboard
        @State private var showMore = true

        var body: some View {
            Color.theme.background
                .sheet(isPresented: $showMore) {
                    MoreTabView(selectedTab: $selectedTab)
                }
        }
    }

    return PreviewWrapper()
}
