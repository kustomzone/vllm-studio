import SwiftUI
import UniformTypeIdentifiers

// MARK: - Code Viewer

/// Full-featured code artifact viewer with syntax highlighting, copy, and share functionality
struct CodeViewer: View {
    let code: String
    let language: String
    let title: String

    @State private var showLineNumbers = true
    @State private var copied = false
    @State private var showingShareSheet = false
    @State private var fontSize: CGFloat = 13
    @State private var wrapLines = false

    @Environment(\.dismiss) private var dismiss

    private let colors = SyntaxColors.shared

    private var syntaxLanguage: SyntaxLanguage {
        SyntaxLanguage(from: language) ?? .plaintext
    }

    private var lineCount: Int {
        code.components(separatedBy: "\n").count
    }

    private var characterCount: Int {
        code.count
    }

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            toolbarView

            Divider()
                .background(Color.theme.border)

            // Code content
            codeContentView

            // Footer with stats
            footerView
        }
        .background(colors.background)
    }

    // MARK: - Toolbar

    private var toolbarView: some View {
        HStack(spacing: .spacing.md) {
            // Language indicator
            HStack(spacing: .spacing.xs) {
                Image(systemName: "chevron.left.forwardslash.chevron.right")
                    .font(.system(size: 12))
                Text(syntaxLanguage.displayName)
                    .font(.theme.caption)
            }
            .foregroundColor(Color.theme.mutedForeground)
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color.theme.backgroundTertiary)
            .clipShape(Capsule())

            Spacer()

            // View options
            HStack(spacing: .spacing.sm) {
                // Line numbers toggle
                Button {
                    showLineNumbers.toggle()
                } label: {
                    Image(systemName: "list.number")
                        .font(.system(size: 14))
                        .foregroundColor(showLineNumbers ? Color.theme.primary : Color.theme.mutedForeground)
                }
                .buttonStyle(.plain)

                // Word wrap toggle
                Button {
                    wrapLines.toggle()
                } label: {
                    Image(systemName: "text.alignleft")
                        .font(.system(size: 14))
                        .foregroundColor(wrapLines ? Color.theme.primary : Color.theme.mutedForeground)
                }
                .buttonStyle(.plain)

                // Font size controls
                Menu {
                    Button("Small (11pt)") { fontSize = 11 }
                    Button("Medium (13pt)") { fontSize = 13 }
                    Button("Large (15pt)") { fontSize = 15 }
                    Button("Extra Large (17pt)") { fontSize = 17 }
                } label: {
                    Image(systemName: "textformat.size")
                        .font(.system(size: 14))
                        .foregroundColor(Color.theme.mutedForeground)
                }

                Divider()
                    .frame(height: 20)

                // Copy button
                Button(action: copyCode) {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                        Text(copied ? "Copied" : "Copy")
                            .font(.theme.caption)
                    }
                    .foregroundColor(copied ? Color.theme.success : Color.theme.foreground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xs)
                    .background(Color.theme.backgroundTertiary)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)

                // Share button
                ShareLink(item: code) {
                    HStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 12))
                        Text("Share")
                            .font(.theme.caption)
                    }
                    .foregroundColor(Color.theme.foreground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xs)
                    .background(Color.theme.backgroundTertiary)
                    .clipShape(Capsule())
                }

                // Download button
                Button(action: downloadCode) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle")
                            .font(.system(size: 12))
                        Text("Download")
                            .font(.theme.caption)
                    }
                    .foregroundColor(Color.theme.foreground)
                    .padding(.horizontal, .spacing.sm)
                    .padding(.vertical, .spacing.xs)
                    .background(Color.theme.backgroundTertiary)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color(hex: "#141414"))
    }

    // MARK: - Code Content

    private var codeContentView: some View {
        GeometryReader { geometry in
            ScrollView([.horizontal, .vertical], showsIndicators: true) {
                codeWithLineNumbers
                    .frame(minWidth: wrapLines ? nil : geometry.size.width, alignment: .topLeading)
            }
        }
    }

    @ViewBuilder
    private var codeWithLineNumbers: some View {
        if showLineNumbers {
            HStack(alignment: .top, spacing: 0) {
                lineNumbersColumn
                codeColumn
            }
        } else {
            codeColumn
                .padding(.spacing.md)
        }
    }

    private var lineNumbersColumn: some View {
        let lines = code.components(separatedBy: "\n")
        let maxDigits = String(lines.count).count

        return VStack(alignment: .trailing, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, _ in
                Text("\(index + 1)")
                    .font(.system(size: fontSize, weight: .regular, design: .monospaced))
                    .foregroundColor(colors.lineNumber)
                    .frame(minWidth: CGFloat(maxDigits) * fontSize * 0.6, alignment: .trailing)
            }
        }
        .padding(.vertical, .spacing.md)
        .padding(.horizontal, .spacing.sm)
        .background(Color(hex: "#121212"))
    }

    private var codeColumn: some View {
        VStack(alignment: .leading, spacing: 0) {
            let lines = SyntaxHighlighter.highlightWithLineNumbers(code, language: syntaxLanguage)
            ForEach(lines, id: \.lineNumber) { line in
                if wrapLines {
                    Text(line.content)
                        .font(.system(size: fontSize, weight: .regular, design: .monospaced))
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(line.content)
                        .font(.system(size: fontSize, weight: .regular, design: .monospaced))
                        .textSelection(.enabled)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
        }
        .padding(.spacing.md)
    }

    // MARK: - Footer

    private var footerView: some View {
        HStack {
            Text("\(lineCount) lines")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            Text("-")
                .foregroundColor(Color.theme.mutedForeground)

            Text("\(characterCount) characters")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)

            Spacer()

            Text("UTF-8")
                .font(.theme.caption)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .padding(.horizontal, .spacing.md)
        .padding(.vertical, .spacing.sm)
        .background(Color(hex: "#141414"))
    }

    // MARK: - Actions

    private func copyCode() {
        UIPasteboard.general.string = code
        copied = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copied = false
        }
    }

    private func downloadCode() {
        // Create a temporary file and trigger share sheet
        let fileName = "\(title.isEmpty ? "code" : title).\(fileExtension)"
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        do {
            try code.write(to: tempURL, atomically: true, encoding: .utf8)
            // Note: In a real app, you'd present a UIActivityViewController or use ShareLink
        } catch {
            print("Failed to save file: \(error)")
        }
    }

    private var fileExtension: String {
        switch syntaxLanguage {
        case .swift: return "swift"
        case .python: return "py"
        case .javascript: return "js"
        case .typescript: return "ts"
        case .json: return "json"
        case .html: return "html"
        case .css: return "css"
        case .bash, .shell: return "sh"
        case .sql: return "sql"
        case .rust: return "rs"
        case .go: return "go"
        case .java: return "java"
        case .kotlin: return "kt"
        case .ruby: return "rb"
        case .php: return "php"
        case .csharp: return "cs"
        case .cpp: return "cpp"
        case .c: return "c"
        case .markdown: return "md"
        case .yaml: return "yaml"
        case .xml: return "xml"
        case .plaintext: return "txt"
        }
    }
}

// MARK: - Code Viewer Sheet

/// A wrapper for presenting CodeViewer as a sheet
struct CodeViewerSheet: View {
    let code: String
    let language: String
    let title: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            CodeViewer(code: code, language: language, title: title)
                .navigationTitle(title)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Done") {
                            dismiss()
                        }
                        .foregroundColor(Color.theme.primary)
                    }
                }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Compact Code Preview

/// A compact preview of code for use in lists or cards
struct CodePreview: View {
    let code: String
    let language: String
    let maxLines: Int
    let onTap: () -> Void

    @State private var copied = false

    private let colors = SyntaxColors.shared

    init(
        code: String,
        language: String,
        maxLines: Int = 5,
        onTap: @escaping () -> Void
    ) {
        self.code = code
        self.language = language
        self.maxLines = maxLines
        self.onTap = onTap
    }

    private var syntaxLanguage: SyntaxLanguage {
        SyntaxLanguage(from: language) ?? .plaintext
    }

    private var previewCode: String {
        let lines = code.components(separatedBy: "\n")
        if lines.count <= maxLines {
            return code
        }
        return lines.prefix(maxLines).joined(separator: "\n") + "\n..."
    }

    private var totalLines: Int {
        code.components(separatedBy: "\n").count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                HStack(spacing: .spacing.xs) {
                    Image(systemName: "chevron.left.forwardslash.chevron.right")
                        .font(.system(size: 10))
                    Text(syntaxLanguage.displayName)
                        .font(.theme.caption2)
                }
                .foregroundColor(colors.lineNumber)

                Spacer()

                Button {
                    UIPasteboard.general.string = code
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        copied = false
                    }
                } label: {
                    Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 10))
                        .foregroundColor(copied ? Color.theme.success : colors.lineNumber)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, .spacing.sm)
            .padding(.vertical, .spacing.xs)
            .background(Color(hex: "#141414"))

            // Code preview
            Button(action: onTap) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(SyntaxHighlighter.highlight(previewCode, language: syntaxLanguage))
                        .font(.system(size: 11, weight: .regular, design: .monospaced))
                        .lineLimit(nil)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.spacing.sm)

                    if totalLines > maxLines {
                        HStack {
                            Spacer()
                            Text("View all \(totalLines) lines")
                                .font(.theme.caption2)
                                .foregroundColor(Color.theme.primary)
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 10))
                                .foregroundColor(Color.theme.primary)
                        }
                        .padding(.horizontal, .spacing.sm)
                        .padding(.bottom, .spacing.xs)
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .background(colors.background)
        .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: .radius.sm)
                .stroke(Color.theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Preview

#if DEBUG
struct CodeViewer_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Full viewer
            CodeViewer(
                code: sampleCode,
                language: "swift",
                title: "ContentView.swift"
            )
            .preferredColorScheme(.dark)

            // Compact preview
            VStack(spacing: 16) {
                CodePreview(
                    code: sampleCode,
                    language: "swift",
                    maxLines: 5
                ) {
                    print("Tapped")
                }
            }
            .padding()
            .background(Color.theme.background)
            .preferredColorScheme(.dark)
        }
    }

    static let sampleCode = """
    import SwiftUI

    struct ContentView: View {
        @State private var count = 0
        @State private var message = "Hello, World!"

        var body: some View {
            VStack(spacing: 20) {
                Text(message)
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Count: \\(count)")
                    .font(.title2)

                HStack(spacing: 16) {
                    Button("Decrement") {
                        count -= 1
                    }
                    .buttonStyle(.bordered)

                    Button("Increment") {
                        count += 1
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
    }

    #Preview {
        ContentView()
    }
    """
}
#endif
