import SwiftUI
import UniformTypeIdentifiers

// MARK: - Code Block View

/// A code display component with syntax highlighting, copy button, and optional line numbers
struct CodeBlock: View {
    let code: String
    let language: SyntaxLanguage
    let showLineNumbers: Bool
    let maxHeight: CGFloat?

    @State private var copied = false
    @Environment(\.colorScheme) private var colorScheme

    private let colors = SyntaxColors.shared

    init(
        code: String,
        language: SyntaxLanguage = .plaintext,
        showLineNumbers: Bool = false,
        maxHeight: CGFloat? = nil
    ) {
        self.code = code
        self.language = language
        self.showLineNumbers = showLineNumbers
        self.maxHeight = maxHeight
    }

    init(
        code: String,
        languageString: String?,
        showLineNumbers: Bool = false,
        maxHeight: CGFloat? = nil
    ) {
        self.code = code
        self.language = SyntaxLanguage(from: languageString ?? "") ?? .plaintext
        self.showLineNumbers = showLineNumbers
        self.maxHeight = maxHeight
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with language and copy button
            headerView

            // Code content
            codeContentView
        }
        .background(colors.background)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    // MARK: - Header View

    private var headerView: some View {
        HStack {
            // Language label
            Text(language.displayName)
                .font(.theme.caption)
                .foregroundColor(colors.lineNumber)

            Spacer()

            // Copy button
            Button(action: copyToClipboard) {
                HStack(spacing: 4) {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 12))
                    Text(copied ? "Copied!" : "Copy")
                        .font(.theme.caption)
                }
                .foregroundColor(copied ? Color.theme.success : colors.lineNumber)
            }
            .buttonStyle(.plain)
            .animation(.easeInOut(duration: 0.2), value: copied)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color(hex: "#141414"))
    }

    // MARK: - Code Content View

    @ViewBuilder
    private var codeContentView: some View {
        let container = ScrollView([.horizontal, .vertical], showsIndicators: true) {
            codeWithLineNumbers
        }

        if let maxHeight = maxHeight {
            container.frame(maxHeight: maxHeight)
        } else {
            container
        }
    }

    @ViewBuilder
    private var codeWithLineNumbers: some View {
        if showLineNumbers {
            HStack(alignment: .top, spacing: 0) {
                lineNumbersView
                highlightedCodeView
            }
        } else {
            highlightedCodeView
                .padding(.spacing.md)
        }
    }

    private var lineNumbersView: some View {
        let lines = code.components(separatedBy: "\n")
        let maxDigits = String(lines.count).count

        return VStack(alignment: .trailing, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, _ in
                Text("\(index + 1)")
                    .font(.theme.code)
                    .foregroundColor(colors.lineNumber)
                    .frame(minWidth: CGFloat(maxDigits * 10), alignment: .trailing)
            }
        }
        .padding(.vertical, .spacing.md)
        .padding(.horizontal, .spacing.sm)
        .background(Color(hex: "#121212"))
    }

    private var highlightedCodeView: some View {
        VStack(alignment: .leading, spacing: 0) {
            let lines = SyntaxHighlighter.highlightWithLineNumbers(code, language: language)
            ForEach(lines, id: \.lineNumber) { line in
                Text(line.content)
                    .textSelection(.enabled)
            }
        }
        .padding(.spacing.md)
    }

    // MARK: - Actions

    private func copyToClipboard() {
        UIPasteboard.general.string = code
        copied = true

        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copied = false
        }
    }
}

// MARK: - Compact Code Block

/// A more compact version of CodeBlock for inline code display
struct CompactCodeBlock: View {
    let code: String
    let language: SyntaxLanguage

    @State private var copied = false

    private let colors = SyntaxColors.shared

    init(code: String, language: SyntaxLanguage = .plaintext) {
        self.code = code
        self.language = language
    }

    init(code: String, languageString: String?) {
        self.code = code
        self.language = SyntaxLanguage(from: languageString ?? "") ?? .plaintext
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                Text(SyntaxHighlighter.highlight(code, language: language))
                    .textSelection(.enabled)
                    .padding(.spacing.sm)
            }

            Spacer(minLength: 0)

            Button(action: copyToClipboard) {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 11))
                    .foregroundColor(copied ? Color.theme.success : colors.lineNumber)
            }
            .buttonStyle(.plain)
            .padding(.spacing.sm)
        }
        .background(colors.background)
        .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.sm)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private func copyToClipboard() {
        UIPasteboard.general.string = code
        copied = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copied = false
        }
    }
}

// MARK: - Inline Code

/// Inline code snippet styling
struct InlineCode: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.theme.code)
            .foregroundColor(Color.theme.foreground)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color(hex: "#2a2a2a"))
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// MARK: - Code Block with Expandable Content

/// A code block that can expand/collapse for long code snippets
struct ExpandableCodeBlock: View {
    let code: String
    let language: SyntaxLanguage
    let collapsedLineCount: Int

    @State private var isExpanded = false

    init(
        code: String,
        language: SyntaxLanguage = .plaintext,
        collapsedLineCount: Int = 10
    ) {
        self.code = code
        self.language = language
        self.collapsedLineCount = collapsedLineCount
    }

    private var lines: [String] {
        code.components(separatedBy: "\n")
    }

    private var shouldShowExpandButton: Bool {
        lines.count > collapsedLineCount
    }

    private var displayedCode: String {
        if isExpanded || !shouldShowExpandButton {
            return code
        }
        return lines.prefix(collapsedLineCount).joined(separator: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CodeBlock(
                code: displayedCode,
                language: language,
                showLineNumbers: true
            )

            if shouldShowExpandButton {
                Button(action: { isExpanded.toggle() }) {
                    HStack {
                        Spacer()
                        HStack(spacing: 4) {
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .font(.system(size: 12))
                            Text(isExpanded ? "Show less" : "Show \(lines.count - collapsedLineCount) more lines")
                                .font(.theme.caption)
                        }
                        .foregroundColor(Color.theme.primary)
                        Spacer()
                    }
                    .padding(.vertical, .spacing.sm)
                    .background(Color(hex: "#141414"))
                }
                .buttonStyle(.plain)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Code Diff Block

/// A code block that shows diff-style additions and deletions
struct CodeDiffBlock: View {
    let oldCode: String
    let newCode: String
    let language: SyntaxLanguage

    @State private var copied = false

    private let colors = SyntaxColors.shared

    init(oldCode: String, newCode: String, language: SyntaxLanguage = .plaintext) {
        self.oldCode = oldCode
        self.newCode = newCode
        self.language = language
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Diff - \(language.displayName)")
                    .font(.theme.caption)
                    .foregroundColor(colors.lineNumber)
                Spacer()
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(Color(hex: "#141414"))

            // Diff content
            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(diffLines.enumerated()), id: \.offset) { _, line in
                        HStack(spacing: 0) {
                            // Status indicator
                            Text(line.prefix)
                                .font(.theme.code)
                                .foregroundColor(line.color)
                                .frame(width: 20, alignment: .center)
                                .background(line.backgroundColor.opacity(0.2))

                            // Code content
                            Text(SyntaxHighlighter.highlight(line.text, language: language))
                                .textSelection(.enabled)
                                .padding(.leading, .spacing.sm)
                        }
                        .background(line.backgroundColor.opacity(0.1))
                    }
                }
                .padding(.spacing.md)
            }
        }
        .background(colors.background)
        .clipShape(RoundedRectangle(cornerRadius: .radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.md)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }

    private var diffLines: [DiffLine] {
        let oldLines = oldCode.components(separatedBy: "\n")
        let newLines = newCode.components(separatedBy: "\n")

        var result: [DiffLine] = []

        // Simple diff algorithm - in production, use a proper diff library
        let maxCount = max(oldLines.count, newLines.count)

        for i in 0..<maxCount {
            let oldLine = i < oldLines.count ? oldLines[i] : nil
            let newLine = i < newLines.count ? newLines[i] : nil

            if oldLine == newLine {
                if let line = oldLine {
                    result.append(DiffLine(text: line, status: .unchanged))
                }
            } else {
                if let old = oldLine {
                    result.append(DiffLine(text: old, status: .removed))
                }
                if let new = newLine {
                    result.append(DiffLine(text: new, status: .added))
                }
            }
        }

        return result
    }
}

// MARK: - Diff Line Model

private struct DiffLine {
    enum Status {
        case unchanged
        case added
        case removed
    }

    let text: String
    let status: Status

    var prefix: String {
        switch status {
        case .unchanged: return " "
        case .added: return "+"
        case .removed: return "-"
        }
    }

    var color: Color {
        switch status {
        case .unchanged: return Color.theme.mutedForeground
        case .added: return Color.theme.success
        case .removed: return Color.theme.error
        }
    }

    var backgroundColor: Color {
        switch status {
        case .unchanged: return .clear
        case .added: return Color.theme.success
        case .removed: return Color.theme.error
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CodeBlock_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Standard Code Block")
                    .font(.headline)
                    .foregroundColor(.white)

                CodeBlock(
                    code: sampleSwift,
                    language: .swift,
                    showLineNumbers: true
                )

                Text("Compact Code Block")
                    .font(.headline)
                    .foregroundColor(.white)

                CompactCodeBlock(
                    code: "let greeting = \"Hello, World!\"",
                    language: .swift
                )

                Text("Inline Code")
                    .font(.headline)
                    .foregroundColor(.white)

                HStack {
                    Text("Use")
                        .foregroundColor(.white)
                    InlineCode(text: "npm install")
                    Text("to install dependencies")
                        .foregroundColor(.white)
                }

                Text("Expandable Code Block")
                    .font(.headline)
                    .foregroundColor(.white)

                ExpandableCodeBlock(
                    code: sampleLongCode,
                    language: .javascript,
                    collapsedLineCount: 5
                )

                Text("Diff Block")
                    .font(.headline)
                    .foregroundColor(.white)

                CodeDiffBlock(
                    oldCode: "let x = 1\nlet y = 2",
                    newCode: "let x = 1\nlet y = 3\nlet z = 4",
                    language: .swift
                )
            }
            .padding()
        }
        .background(Color.theme.background)
        .preferredColorScheme(.dark)
    }

    static let sampleSwift = """
    import SwiftUI

    struct ContentView: View {
        @State private var count = 0

        var body: some View {
            VStack {
                Text("Count: \\(count)")
                Button("Increment") {
                    count += 1
                }
            }
        }
    }
    """

    static let sampleLongCode = """
    // This is a longer code sample
    function processData(items) {
        return items
            .filter(item => item.active)
            .map(item => ({
                id: item.id,
                name: item.name.toUpperCase(),
                value: item.value * 2
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .reduce((acc, item) => {
                acc[item.id] = item;
                return acc;
            }, {});
    }

    // Export the function
    export default processData;
    """
}
#endif
