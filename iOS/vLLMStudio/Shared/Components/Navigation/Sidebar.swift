import SwiftUI

/// iPad sidebar navigation matching the web app's sidebar
struct Sidebar: View {
    @Binding var selectedTab: AppTab
    var serverStatus: ServerStatus
    var onSettingsPressed: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            // Header with logo
            SidebarHeader()

            // Connection status
            ConnectionStatusView(status: serverStatus)
                .padding(.horizontal, .spacing.md)
                .padding(.bottom, .spacing.md)

            Divider()
                .background(Color.theme.border)

            // Navigation items
            ScrollView {
                VStack(spacing: .spacing.xs) {
                    ForEach(AppTab.allTabs) { tab in
                        SidebarItem(
                            tab: tab,
                            isSelected: selectedTab == tab
                        ) {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedTab = tab
                            }
                        }
                    }
                }
                .padding(.spacing.md)
            }

            Spacer()

            Divider()
                .background(Color.theme.border)

            // Footer with settings
            SidebarFooter(onSettingsPressed: onSettingsPressed)
        }
        .frame(width: 260)
        .background(Color.theme.backgroundSecondary)
    }
}

// MARK: - Server Status

enum ServerStatus {
    case connected
    case connecting
    case disconnected
    case error(String)

    var statusBadge: StatusBadge.Status {
        switch self {
        case .connected: return .online
        case .connecting: return .loading
        case .disconnected: return .offline
        case .error: return .error
        }
    }

    var label: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting..."
        case .disconnected: return "Disconnected"
        case .error(let message): return message
        }
    }
}

// MARK: - Sidebar Header

struct SidebarHeader: View {
    var body: some View {
        HStack(spacing: .spacing.md) {
            // App icon
            RoundedRectangle(cornerRadius: .radius.md)
                .fill(
                    LinearGradient(
                        colors: [Color.theme.primary, Color.theme.primaryHover],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: "cube.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text("vLLM Studio")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Text("Local AI Inference")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)
            }

            Spacer()
        }
        .padding(.spacing.lg)
    }
}

// MARK: - Connection Status View

struct ConnectionStatusView: View {
    let status: ServerStatus

    var body: some View {
        HStack(spacing: .spacing.sm) {
            StatusBadge(status: status.statusBadge, size: .small)

            if case .error = status {
                Spacer()
                Button {
                    // Retry connection
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(Color.theme.primary)
                }
            }
        }
        .padding(.spacing.sm)
        .background(Color.theme.card)
        .cornerRadius(.radius.md)
    }
}

// MARK: - Sidebar Item

struct SidebarItem: View {
    let tab: AppTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .spacing.md) {
                Image(systemName: isSelected ? tab.selectedIcon : tab.icon)
                    .font(.system(size: 18))
                    .foregroundColor(isSelected ? Color.theme.primary : Color.theme.mutedForeground)
                    .frame(width: 24)

                Text(tab.title)
                    .font(.theme.body)
                    .fontWeight(isSelected ? .medium : .regular)
                    .foregroundColor(isSelected ? Color.theme.foreground : Color.theme.mutedForeground)

                Spacer()
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(
                isSelected ?
                Color.theme.primary.opacity(0.1) :
                Color.clear
            )
            .cornerRadius(.radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(
                        isSelected ? Color.theme.primary.opacity(0.3) : Color.clear,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Sidebar Footer

struct SidebarFooter: View {
    var onSettingsPressed: (() -> Void)?

    var body: some View {
        VStack(spacing: .spacing.sm) {
            // Version info
            HStack {
                Text("Version 1.0.0")
                    .font(.theme.caption)
                    .foregroundColor(Color.theme.mutedForeground)

                Spacer()

                if let onSettingsPressed = onSettingsPressed {
                    Button(action: onSettingsPressed) {
                        Image(systemName: "gearshape")
                            .font(.system(size: 16))
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }
        }
        .padding(.spacing.md)
    }
}

// MARK: - Collapsible Sidebar

/// A sidebar that can be collapsed to icons only
struct CollapsibleSidebar: View {
    @Binding var selectedTab: AppTab
    @Binding var isCollapsed: Bool
    var serverStatus: ServerStatus

    var body: some View {
        VStack(spacing: 0) {
            // Collapse toggle
            Button {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isCollapsed.toggle()
                }
            } label: {
                Image(systemName: isCollapsed ? "sidebar.left" : "sidebar.right")
                    .font(.system(size: 18))
                    .foregroundColor(Color.theme.mutedForeground)
                    .frame(maxWidth: .infinity, alignment: isCollapsed ? .center : .trailing)
                    .padding(.spacing.md)
            }

            if !isCollapsed {
                SidebarHeader()

                ConnectionStatusView(status: serverStatus)
                    .padding(.horizontal, .spacing.md)
                    .padding(.bottom, .spacing.md)
            }

            Divider()
                .background(Color.theme.border)

            // Navigation items
            ScrollView {
                VStack(spacing: .spacing.xs) {
                    ForEach(AppTab.allTabs) { tab in
                        if isCollapsed {
                            CollapsedSidebarItem(
                                tab: tab,
                                isSelected: selectedTab == tab
                            ) {
                                selectedTab = tab
                            }
                        } else {
                            SidebarItem(
                                tab: tab,
                                isSelected: selectedTab == tab
                            ) {
                                selectedTab = tab
                            }
                        }
                    }
                }
                .padding(.spacing.md)
            }

            Spacer()
        }
        .frame(width: isCollapsed ? 64 : 260)
        .background(Color.theme.backgroundSecondary)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isCollapsed)
    }
}

// MARK: - Collapsed Sidebar Item

struct CollapsedSidebarItem: View {
    let tab: AppTab
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isSelected ? tab.selectedIcon : tab.icon)
                .font(.system(size: 20))
                .foregroundColor(isSelected ? Color.theme.primary : Color.theme.mutedForeground)
                .frame(width: 40, height: 40)
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

// MARK: - Previews

#Preview("Sidebar") {
    struct PreviewWrapper: View {
        @State private var selectedTab: AppTab = .dashboard

        var body: some View {
            HStack(spacing: 0) {
                Sidebar(
                    selectedTab: $selectedTab,
                    serverStatus: .connected
                )

                Color.theme.background
            }
        }
    }

    return PreviewWrapper()
}

#Preview("Collapsible Sidebar") {
    struct PreviewWrapper: View {
        @State private var selectedTab: AppTab = .dashboard
        @State private var isCollapsed: Bool = false

        var body: some View {
            HStack(spacing: 0) {
                CollapsibleSidebar(
                    selectedTab: $selectedTab,
                    isCollapsed: $isCollapsed,
                    serverStatus: .connecting
                )

                Color.theme.background
            }
        }
    }

    return PreviewWrapper()
}

#Preview("Connection Status") {
    VStack(spacing: 12) {
        ConnectionStatusView(status: .connected)
        ConnectionStatusView(status: .connecting)
        ConnectionStatusView(status: .disconnected)
        ConnectionStatusView(status: .error("Connection refused"))
    }
    .padding()
    .background(Color.theme.backgroundSecondary)
}
