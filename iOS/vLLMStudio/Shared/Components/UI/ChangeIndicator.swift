import SwiftUI

/// A value change indicator with up/down arrows and color coding
struct ChangeIndicator: View {
    let change: Change
    var format: DisplayFormat
    var size: IndicatorSize

    init(change: Change, format: DisplayFormat = .percentage, size: IndicatorSize = .medium) {
        self.change = change
        self.format = format
        self.size = size
    }

    var body: some View {
        HStack(spacing: size.spacing) {
            // Arrow Icon
            Image(systemName: change.iconName)
                .font(.system(size: size.iconSize, weight: .semibold))

            // Value Display
            Text(formattedValue)
                .font(size.font)
                .fontWeight(.medium)
        }
        .foregroundColor(change.color)
        .padding(.horizontal, size.horizontalPadding)
        .padding(.vertical, size.verticalPadding)
        .background(change.color.opacity(0.1))
        .clipShape(Capsule())
    }

    private var formattedValue: String {
        switch format {
        case .percentage:
            return change.percentageString
        case .value:
            return change.valueString
        case .both:
            return "\(change.valueString) (\(change.percentageString))"
        }
    }
}

// MARK: - Change Type

extension ChangeIndicator {
    enum Change {
        case increase(value: Double, percentage: Double?)
        case decrease(value: Double, percentage: Double?)
        case unchanged

        var iconName: String {
            switch self {
            case .increase:
                return "arrow.up"
            case .decrease:
                return "arrow.down"
            case .unchanged:
                return "minus"
            }
        }

        var color: Color {
            switch self {
            case .increase:
                return Color.theme.success
            case .decrease:
                return Color.theme.error
            case .unchanged:
                return Color.theme.mutedForeground
            }
        }

        var percentageString: String {
            switch self {
            case .increase(_, let percentage), .decrease(_, let percentage):
                if let percentage = percentage {
                    return String(format: "%.1f%%", abs(percentage))
                }
                return ""
            case .unchanged:
                return "0%"
            }
        }

        var valueString: String {
            switch self {
            case .increase(let value, _), .decrease(let value, _):
                return formatValue(abs(value))
            case .unchanged:
                return "0"
            }
        }

        private func formatValue(_ value: Double) -> String {
            if value >= 1_000_000 {
                return String(format: "%.1fM", value / 1_000_000)
            } else if value >= 1_000 {
                return String(format: "%.1fK", value / 1_000)
            } else if value == floor(value) {
                return String(format: "%.0f", value)
            } else {
                return String(format: "%.2f", value)
            }
        }
    }

    enum DisplayFormat {
        case percentage
        case value
        case both
    }
}

// MARK: - Indicator Size

extension ChangeIndicator {
    enum IndicatorSize {
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

        var iconSize: CGFloat {
            switch self {
            case .small: return 8
            case .medium: return 10
            case .large: return 12
            }
        }

        var spacing: CGFloat {
            switch self {
            case .small: return 2
            case .medium: return 4
            case .large: return 6
            }
        }

        var horizontalPadding: CGFloat {
            switch self {
            case .small: return 4
            case .medium: return 6
            case .large: return 8
            }
        }

        var verticalPadding: CGFloat {
            switch self {
            case .small: return 2
            case .medium: return 3
            case .large: return 4
            }
        }
    }
}

// MARK: - Inline Change Text

/// A simple inline change indicator without background
struct InlineChangeIndicator: View {
    let change: ChangeIndicator.Change
    var showIcon: Bool

    init(change: ChangeIndicator.Change, showIcon: Bool = true) {
        self.change = change
        self.showIcon = showIcon
    }

    var body: some View {
        HStack(spacing: 2) {
            if showIcon {
                Image(systemName: change.iconName)
                    .font(.system(size: 10, weight: .semibold))
            }

            Text(change.percentageString)
                .font(.theme.caption)
                .fontWeight(.medium)
        }
        .foregroundColor(change.color)
    }
}

// MARK: - Metric Card with Change

/// A metric display card with change indicator
struct MetricWithChange: View {
    let title: String
    let value: String
    let change: ChangeIndicator.Change

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.sm) {
            Text(title)
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            HStack(alignment: .firstTextBaseline, spacing: .spacing.sm) {
                Text(value)
                    .font(.theme.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.foreground)

                InlineChangeIndicator(change: change)
            }
        }
    }
}

// MARK: - Convenience Initializers

extension ChangeIndicator {
    /// Create a change indicator from old and new values
    static func from(oldValue: Double, newValue: Double) -> ChangeIndicator {
        let difference = newValue - oldValue
        let percentage = oldValue != 0 ? (difference / oldValue) * 100 : 0

        if difference > 0 {
            return ChangeIndicator(change: .increase(value: difference, percentage: percentage))
        } else if difference < 0 {
            return ChangeIndicator(change: .decrease(value: abs(difference), percentage: abs(percentage)))
        } else {
            return ChangeIndicator(change: .unchanged)
        }
    }
}

// MARK: - Previews

#Preview("Change Indicators") {
    VStack(spacing: 16) {
        HStack(spacing: 12) {
            ChangeIndicator(change: .increase(value: 125, percentage: 12.5))
            ChangeIndicator(change: .decrease(value: 50, percentage: 5.0))
            ChangeIndicator(change: .unchanged)
        }

        HStack(spacing: 12) {
            ChangeIndicator(change: .increase(value: 125, percentage: 12.5), format: .value)
            ChangeIndicator(change: .decrease(value: 50, percentage: 5.0), format: .value)
        }

        HStack(spacing: 12) {
            ChangeIndicator(change: .increase(value: 1500, percentage: 15.0), format: .both, size: .large)
        }
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Indicator Sizes") {
    VStack(spacing: 12) {
        ChangeIndicator(change: .increase(value: 100, percentage: 10.0), size: .small)
        ChangeIndicator(change: .increase(value: 100, percentage: 10.0), size: .medium)
        ChangeIndicator(change: .increase(value: 100, percentage: 10.0), size: .large)
    }
    .padding()
    .background(Color.theme.background)
}

#Preview("Metric With Change") {
    VStack(spacing: 20) {
        MetricWithChange(
            title: "Total Requests",
            value: "12,456",
            change: .increase(value: 1234, percentage: 11.0)
        )

        MetricWithChange(
            title: "Error Rate",
            value: "0.5%",
            change: .decrease(value: 0.2, percentage: 28.6)
        )
    }
    .padding()
    .background(Color.theme.card)
    .cornerRadius(.radius.lg)
    .padding()
    .background(Color.theme.background)
}
