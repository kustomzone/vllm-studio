import SwiftUI
import Charts

/// A themed line chart wrapper using Swift Charts
struct LineChartView: View {
    let data: [ChartDataPoint]
    var title: String?
    var yAxisLabel: String?
    var showGrid: Bool
    var showArea: Bool
    var lineColor: Color
    var areaGradient: Bool

    init(
        data: [ChartDataPoint],
        title: String? = nil,
        yAxisLabel: String? = nil,
        showGrid: Bool = true,
        showArea: Bool = true,
        lineColor: Color = Color.theme.primary,
        areaGradient: Bool = true
    ) {
        self.data = data
        self.title = title
        self.yAxisLabel = yAxisLabel
        self.showGrid = showGrid
        self.showArea = showArea
        self.lineColor = lineColor
        self.areaGradient = areaGradient
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            if let title = title {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
            }

            Chart {
                ForEach(data) { point in
                    if showArea {
                        AreaMark(
                            x: .value("Date", point.date),
                            y: .value(yAxisLabel ?? "Value", point.value)
                        )
                        .foregroundStyle(
                            areaGradient ?
                            LinearGradient(
                                colors: [
                                    lineColor.opacity(0.3),
                                    lineColor.opacity(0.05)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            ) :
                            LinearGradient(
                                colors: [lineColor.opacity(0.2)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                    }

                    LineMark(
                        x: .value("Date", point.date),
                        y: .value(yAxisLabel ?? "Value", point.value)
                    )
                    .foregroundStyle(lineColor)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    .interpolationMethod(.catmullRom)
                }
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(showGrid ? Color.theme.border : .clear)
                    AxisTick(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.theme.border)
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(showGrid ? Color.theme.border : .clear)
                    AxisTick(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.theme.border)
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
            .chartPlotStyle { plotArea in
                plotArea
                    .background(Color.theme.card.opacity(0.5))
            }
        }
    }
}

// MARK: - Chart Data Point

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
    let label: String?

    init(date: Date, value: Double, label: String? = nil) {
        self.date = date
        self.value = value
        self.label = label
    }
}

// MARK: - Multi-Line Chart

/// A chart with multiple data series
struct MultiLineChartView: View {
    let series: [ChartSeries]
    var title: String?
    var yAxisLabel: String?
    var showLegend: Bool

    init(
        series: [ChartSeries],
        title: String? = nil,
        yAxisLabel: String? = nil,
        showLegend: Bool = true
    ) {
        self.series = series
        self.title = title
        self.yAxisLabel = yAxisLabel
        self.showLegend = showLegend
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            if let title = title {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
            }

            Chart {
                ForEach(series) { seriesData in
                    ForEach(seriesData.data) { point in
                        LineMark(
                            x: .value("Date", point.date),
                            y: .value(yAxisLabel ?? "Value", point.value)
                        )
                        .foregroundStyle(by: .value("Series", seriesData.name))
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.catmullRom)
                    }
                }
            }
            .chartForegroundStyleScale(
                domain: series.map { $0.name },
                range: series.map { $0.color }
            )
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.theme.border)
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 5)) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.theme.border)
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
            .chartLegend(showLegend ? .visible : .hidden)
            .chartLegend(position: .bottom, alignment: .leading)
        }
    }
}

// MARK: - Chart Series

struct ChartSeries: Identifiable {
    let id = UUID()
    let name: String
    let data: [ChartDataPoint]
    let color: Color

    init(name: String, data: [ChartDataPoint], color: Color) {
        self.name = name
        self.data = data
        self.color = color
    }
}

// MARK: - Bar Chart View

/// A themed bar chart
struct BarChartView: View {
    let data: [BarChartDataPoint]
    var title: String?
    var barColor: Color
    var showValues: Bool

    init(
        data: [BarChartDataPoint],
        title: String? = nil,
        barColor: Color = Color.theme.primary,
        showValues: Bool = false
    ) {
        self.data = data
        self.title = title
        self.barColor = barColor
        self.showValues = showValues
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            if let title = title {
                Text(title)
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)
            }

            Chart(data) { point in
                BarMark(
                    x: .value("Category", point.label),
                    y: .value("Value", point.value)
                )
                .foregroundStyle(barColor.gradient)
                .cornerRadius(.radius.sm)

                if showValues {
                    RuleMark(y: .value("Value", point.value))
                        .annotation(position: .top) {
                            Text(point.formattedValue)
                                .font(.theme.caption2)
                                .foregroundColor(Color.theme.mutedForeground)
                        }
                        .foregroundStyle(.clear)
                }
            }
            .chartXAxis {
                AxisMarks { _ in
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                        .foregroundStyle(Color.theme.border)
                    AxisValueLabel()
                        .foregroundStyle(Color.theme.mutedForeground)
                        .font(.theme.caption2)
                }
            }
        }
    }
}

// MARK: - Bar Chart Data Point

struct BarChartDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: Double

    var formattedValue: String {
        if value >= 1_000_000 {
            return String(format: "%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "%.1fK", value / 1_000)
        } else {
            return String(format: "%.0f", value)
        }
    }
}

// MARK: - Sparkline View

/// A minimal sparkline chart for inline display
struct SparklineView: View {
    let data: [Double]
    var lineColor: Color
    var height: CGFloat

    init(data: [Double], lineColor: Color = Color.theme.primary, height: CGFloat = 30) {
        self.data = data
        self.lineColor = lineColor
        self.height = height
    }

    var body: some View {
        let dataPoints = data.enumerated().map { index, value in
            ChartDataPoint(date: Date().addingTimeInterval(TimeInterval(index * 3600)), value: value)
        }

        Chart(dataPoints) { point in
            LineMark(
                x: .value("Index", point.date),
                y: .value("Value", point.value)
            )
            .foregroundStyle(lineColor)
            .lineStyle(StrokeStyle(lineWidth: 1.5))
            .interpolationMethod(.catmullRom)

            AreaMark(
                x: .value("Index", point.date),
                y: .value("Value", point.value)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [lineColor.opacity(0.2), lineColor.opacity(0.02)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .frame(height: height)
    }
}

// MARK: - Chart Card Container

/// A card container for charts with title and optional action
struct ChartCard<Content: View>: View {
    let title: String
    let subtitle: String?
    let action: (() -> Void)?
    let content: Content

    init(
        title: String,
        subtitle: String? = nil,
        action: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.action = action
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: .spacing.xxs) {
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

                if let action = action {
                    Button(action: action) {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color.theme.mutedForeground)
                    }
                }
            }

            content
        }
        .padding(.spacing.lg)
        .background(Color.theme.card)
        .cornerRadius(.radius.lg)
        .overlay(
            RoundedRectangle(cornerRadius: .radius.lg)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Preview Helpers

extension ChartDataPoint {
    static var sampleData: [ChartDataPoint] {
        let calendar = Calendar.current
        return (0..<14).map { day in
            ChartDataPoint(
                date: calendar.date(byAdding: .day, value: -13 + day, to: Date()) ?? Date(),
                value: Double.random(in: 100...500)
            )
        }
    }
}

// MARK: - Previews

#Preview("Line Chart") {
    LineChartView(
        data: ChartDataPoint.sampleData,
        title: "Daily Requests",
        yAxisLabel: "Requests"
    )
    .frame(height: 200)
    .padding()
    .background(Color.theme.background)
}

#Preview("Multi-Line Chart") {
    MultiLineChartView(
        series: [
            ChartSeries(
                name: "Requests",
                data: ChartDataPoint.sampleData,
                color: Color.theme.primary
            ),
            ChartSeries(
                name: "Errors",
                data: (0..<14).map { day in
                    ChartDataPoint(
                        date: Calendar.current.date(byAdding: .day, value: -13 + day, to: Date()) ?? Date(),
                        value: Double.random(in: 0...50)
                    )
                },
                color: Color.theme.error
            )
        ],
        title: "Requests vs Errors"
    )
    .frame(height: 250)
    .padding()
    .background(Color.theme.background)
}

#Preview("Bar Chart") {
    BarChartView(
        data: [
            BarChartDataPoint(label: "Mon", value: 150),
            BarChartDataPoint(label: "Tue", value: 230),
            BarChartDataPoint(label: "Wed", value: 180),
            BarChartDataPoint(label: "Thu", value: 290),
            BarChartDataPoint(label: "Fri", value: 340),
            BarChartDataPoint(label: "Sat", value: 120),
            BarChartDataPoint(label: "Sun", value: 90)
        ],
        title: "Weekly Activity",
        showValues: true
    )
    .frame(height: 200)
    .padding()
    .background(Color.theme.background)
}

#Preview("Sparkline") {
    HStack {
        VStack(alignment: .leading) {
            Text("12,456")
                .font(.theme.title2)
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.foreground)
            Text("Total Requests")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)
        }

        Spacer()

        SparklineView(
            data: [10, 25, 18, 35, 28, 42, 38, 50, 45, 55],
            height: 40
        )
        .frame(width: 100)
    }
    .padding()
    .background(Color.theme.card)
    .cornerRadius(.radius.lg)
    .padding()
    .background(Color.theme.background)
}

#Preview("Chart Card") {
    ChartCard(
        title: "Usage Trend",
        subtitle: "Last 14 days"
    ) {
        LineChartView(
            data: ChartDataPoint.sampleData,
            showGrid: false
        )
        .frame(height: 150)
    }
    .padding()
    .background(Color.theme.background)
}
