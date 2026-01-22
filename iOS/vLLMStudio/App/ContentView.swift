//
//  ContentView.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import SwiftUI

/// Root navigation view for the vLLM Studio app.
/// Adapts layout between iPhone (TabView) and iPad (NavigationSplitView).
struct ContentView: View {

    // MARK: - Environment

    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    // MARK: - Body

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                iPhoneLayout
            } else {
                iPadLayout
            }
        }
        .background(Color.theme.background)
    }

    // MARK: - iPhone Layout

    /// Tab-based navigation for iPhone
    private var iPhoneLayout: some View {
        @Bindable var state = appState

        return TabView(selection: $state.selectedTab) {
            DashboardView()
                .tabItem {
                    Label(Tab.dashboard.rawValue, systemImage: Tab.dashboard.icon)
                }
                .tag(Tab.dashboard)

            ChatView()
                .tabItem {
                    Label(Tab.chat.rawValue, systemImage: Tab.chat.icon)
                }
                .tag(Tab.chat)

            RecipesView()
                .tabItem {
                    Label(Tab.recipes.rawValue, systemImage: Tab.recipes.icon)
                }
                .tag(Tab.recipes)

            MoreMenuView()
                .tabItem {
                    Label("More", systemImage: "ellipsis.circle")
                }
                .tag(Tab.logs)
        }
        .tint(Color.theme.primary)
    }

    // MARK: - iPad Layout

    /// Split view navigation for iPad
    private var iPadLayout: some View {
        @Bindable var state = appState

        return NavigationSplitView {
            Sidebar()
        } detail: {
            detailView(for: state.selectedTab)
        }
        .navigationSplitViewStyle(.balanced)
    }

    // MARK: - Detail View

    /// Returns the appropriate detail view for the selected tab
    @ViewBuilder
    private func detailView(for tab: Tab) -> some View {
        switch tab {
        case .dashboard:
            DashboardView()
        case .chat:
            ChatView()
        case .recipes:
            RecipesView()
        case .logs:
            LogsView()
        case .usage:
            UsageView()
        case .configs:
            ConfigsView()
        case .discover:
            DiscoverView()
        }
    }
}

// MARK: - More Menu View

/// Additional menu for iPhone to access less frequently used features
struct MoreMenuView: View {

    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                NavigationLink {
                    LogsView()
                } label: {
                    Label(Tab.logs.rawValue, systemImage: Tab.logs.icon)
                }

                NavigationLink {
                    UsageView()
                } label: {
                    Label(Tab.usage.rawValue, systemImage: Tab.usage.icon)
                }

                NavigationLink {
                    ConfigsView()
                } label: {
                    Label(Tab.configs.rawValue, systemImage: Tab.configs.icon)
                }

                NavigationLink {
                    DiscoverView()
                } label: {
                    Label(Tab.discover.rawValue, systemImage: Tab.discover.icon)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.theme.background)
            .navigationTitle("More")
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environment(AppState())
        .environment(ChatViewModel())
        .preferredColorScheme(.dark)
}
