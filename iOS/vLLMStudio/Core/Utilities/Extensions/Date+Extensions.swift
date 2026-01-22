//
//  Date+Extensions.swift
//  vLLMStudio
//
//  Created by vLLM Studio Team
//  Copyright 2026. All rights reserved.
//

import Foundation

// MARK: - Formatting

extension Date {

    /// Returns the date as a relative string (e.g., "2 hours ago")
    var relativeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    /// Returns the date as a full relative string (e.g., "2 hours ago")
    var relativeStringFull: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    /// Formats the date with a standard format
    /// - Parameter style: The date style to use
    func formatted(style: DateFormatter.Style) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = style
        formatter.timeStyle = .none
        return formatter.string(from: self)
    }

    /// Formats the date and time
    /// - Parameters:
    ///   - dateStyle: The date style
    ///   - timeStyle: The time style
    func formatted(dateStyle: DateFormatter.Style, timeStyle: DateFormatter.Style) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = dateStyle
        formatter.timeStyle = timeStyle
        return formatter.string(from: self)
    }

    /// Formats the date with a custom format string
    /// - Parameter format: The format string (e.g., "yyyy-MM-dd")
    func formatted(as format: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        return formatter.string(from: self)
    }

    /// Returns the time portion as a string
    var timeString: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }

    /// Returns a short date string (e.g., "Jan 15")
    var shortDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: self)
    }

    /// Returns ISO 8601 formatted string
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}

// MARK: - Comparisons

extension Date {

    /// Whether the date is today
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Whether the date is yesterday
    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    /// Whether the date is in the current week
    var isThisWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }

    /// Whether the date is in the current month
    var isThisMonth: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .month)
    }

    /// Whether the date is in the current year
    var isThisYear: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .year)
    }

    /// Whether the date is in the past
    var isPast: Bool {
        self < Date()
    }

    /// Whether the date is in the future
    var isFuture: Bool {
        self > Date()
    }
}

// MARK: - Components

extension Date {

    /// The start of the day
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    /// The end of the day
    var endOfDay: Date {
        var components = DateComponents()
        components.day = 1
        components.second = -1
        return Calendar.current.date(byAdding: components, to: startOfDay) ?? self
    }

    /// The start of the week
    var startOfWeek: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: self)
        return calendar.date(from: components) ?? self
    }

    /// The start of the month
    var startOfMonth: Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: self)
        return calendar.date(from: components) ?? self
    }

    /// The hour component
    var hour: Int {
        Calendar.current.component(.hour, from: self)
    }

    /// The minute component
    var minute: Int {
        Calendar.current.component(.minute, from: self)
    }

    /// The day of the week (1 = Sunday, 7 = Saturday)
    var dayOfWeek: Int {
        Calendar.current.component(.weekday, from: self)
    }

    /// The day of the month
    var dayOfMonth: Int {
        Calendar.current.component(.day, from: self)
    }

    /// The month number (1-12)
    var month: Int {
        Calendar.current.component(.month, from: self)
    }

    /// The year
    var year: Int {
        Calendar.current.component(.year, from: self)
    }
}

// MARK: - Arithmetic

extension Date {

    /// Adds days to the date
    /// - Parameter days: Number of days to add
    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }

    /// Adds hours to the date
    /// - Parameter hours: Number of hours to add
    func adding(hours: Int) -> Date {
        Calendar.current.date(byAdding: .hour, value: hours, to: self) ?? self
    }

    /// Adds minutes to the date
    /// - Parameter minutes: Number of minutes to add
    func adding(minutes: Int) -> Date {
        Calendar.current.date(byAdding: .minute, value: minutes, to: self) ?? self
    }

    /// Returns the number of days between this date and another
    /// - Parameter date: The other date
    func days(until date: Date) -> Int {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: self, to: date)
        return components.day ?? 0
    }

    /// Returns the number of hours between this date and another
    /// - Parameter date: The other date
    func hours(until date: Date) -> Int {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour], from: self, to: date)
        return components.hour ?? 0
    }
}

// MARK: - Chat Grouping

extension Date {

    /// Returns a grouping label for chat messages
    var chatGroupLabel: String {
        if isToday {
            return "Today"
        } else if isYesterday {
            return "Yesterday"
        } else if isThisWeek {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEEE" // Day name
            return formatter.string(from: self)
        } else if isThisYear {
            return shortDateString
        } else {
            return formatted(style: .medium)
        }
    }
}
