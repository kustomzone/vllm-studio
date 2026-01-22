import SwiftUI

/// A status indicator badge with pill shape, icon, and text
struct StatusBadge: View {
    let status: Status
    var showIcon: Bool
    var size: BadgeSize

    init(status: Status, showIcon: Bool = true, size: BadgeSize = .medium) {
        self.status = status
        self.showIcon = showIcon
        self.size = size
    }

    var body: some View {
        HStack(spacing: size.spacing) {
            if showIcon {
                statusIcon
            }

            Text(status.label)
                .font(size.font)
                .fontWeight(.medium)
        }
        .foregroundColor(status.foregroundColor)
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, size.verticalPadding)
        .background(status.backgroundColor)
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var statusIcon: some View {
        switch status {
        case .online, .ready:
            Circle()
                .fill(status.foregroundColor)
                .frame(width: size.dotSize, height: size.dotSize)

        case .offline, .stopped:
            Circle()
                .fill(status.foregroundColor)
                .frame(width: size.dotSize, height: size.dotSize)

        case .loading, .launching:
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: status.foregroundColor))
                .scaleEffect(size.progressScale)

        case .error:
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: size.iconSize))

        case .warning:
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: size.iconSize))

        case .idle:
            Circle()
                .stroke(status.foregroundColor, lineWidth: 1.5)
                .frame(width: size.dotSize, height: size.dotSize)

        case .custom(_, let icon, _, _):
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: size.iconSize))
            } else {
                Circle()
                    .fill(status.foregroundColor)
                    .frame(width: size.dotSize, height: size.dotSize)
            }
        }
    }
}

// MARK: - Status Type

extension StatusBadge {
    enum Status {
        case online
        case offline
        case loading
        case error
        case warning
        case ready
        case idle
        case launching
        case stopped
        case custom(label: String, icon: String?, foreground: Color, background: Color)

        var label: String {
            switch self {
            case .online: return "Online"
            case .offline: return "Offline"
            case .loading: return "Loading"
            case .error: return "Error"
            case .warning: return "Warning"
            case .ready: return "Ready"
            case .idle: return "Idle"
            case .launching: return "Launching"
            case .stopped: return "Stopped"
            case .custom(let label, _, _, _): return label
            }
        }

        var foregroundColor: Color {
            switch self {
            case .online, .ready:
                return Color.theme.success
            case .offline, .stopped:
                return Color.theme.mutedForeground
            case .loading, .launching:
                return Color.theme.primary
            case .error:
                return Color.theme.error
            case .warning:
                return Color.theme.warning
            case .idle:
                return Color.theme.mutedForeground
            case .custom(_, _, let foreground, _):
                return foreground
            }
        }

        var backgroundColor: Color {
            switch self {
            case .online, .ready:
                return Color.theme.success.opacity(0.15)
            case .offline, .stopped:
                return Color.theme.mutedForeground.opacity(0.15)
            case .loading, .launching:
                return Color.theme.primary.opacity(0.15)
            case .error:
                return Color.theme.error.opacity(0.15)
            case .warning:
                return Color.theme.warning.opacity(0.15)
            case .idle:
                return Color.theme.mutedForeground.opacity(0.1)
            case .custom(_, _, _, let background):
                return background
            }
        }
    }
}

// MARK: - Badge Size

extension StatusBadge {
    enum BadgeSize {
        case small
        case medium
        case large

        var font: Font {
            switch self {
            case .small: return .theme.caption2
            case .medium: return .theme.caption
            case .large: return .theme.body
            }
        }

        var horizontalPadding: CGFloat {
            switch self {
            case .small: return 6
            case .medium: return 8
            case .large: return 12
            }
        }

        var verticalPadding: CGFloat {
            switch self {
            case .small: return 2
            case .medium: return 4
            case .large: return 6
            }
        }

        var spacing: CGFloat {
            switch self {
            case .small: return 4
            case .medium: return 6
            case .large: return 8
            }
        }

        var dotSize: CGFloat {
            switch self {
            case .small: return 5
            case .medium: return 6
            case .large: return 8
            }
        }

        var iconSize: CGFloat {
            switch self {
            case .small: return 10
            case .medium: return 12
            case .large: return 14
            }
        }

        var progressScale: CGFloat {
            switch self {
            case .small: return 0.5
            case .medium: return 0.6
            case .large: return 0.7
            }
        }
    }
}

// MARK: - Dot Status Indicator

/// A minimal dot-only status indicator
struct StatusDot: View {
    let status: StatusBadge.Status
    var size: CGFloat

    init(status: StatusBadge.Status, size: CGFloat = 8) {
        self.status = status
        self.size = size
    }

    var body: some View {
        Circle()
            .fill(status.foregroundColor)
            .frame(width: size, height: size)
    }
}

// MARK: - Previews

#Preview("Status Badges") {
    VStack(spacing: 12) {
        HStack(spacing: 12) {
            StatusBadge(status: .online)
            StatusBadge(status: .offline)
            StatusBadge(status: .loading)
        }

        HStack(spacing: 12) {
            StatusBadge(status: .error)
            StatusBadge(status: .warning)
            StatusBadge(status: .idle)
        }

        HStack(spacing: 12) {
            StatusBadge(status: .ready)
            StatusBadge(status: .launching)
            StatusBadge(status: .stopped)
        }
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Badge Sizes") {
    VStack(spacing: 12) {
        StatusBadge(status: .online, size: .small)
        StatusBadge(status: .online, size: .medium)
        StatusBadge(status: .online, size: .large)
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Custom Badge") {
    StatusBadge(
        status: .custom(
            label: "GPU Active",
            icon: "bolt.fill",
            foreground: Color.theme.info,
            background: Color.theme.info.opacity(0.15)
        )
    )
    .padding()
    .background(Color.theme.background)
}

#Preview("Status Dots") {
    HStack(spacing: 12) {
        StatusDot(status: .online)
        StatusDot(status: .offline)
        StatusDot(status: .error)
        StatusDot(status: .loading)
    }
    .padding()
    .background(Color.theme.background)
}
