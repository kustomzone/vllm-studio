import SwiftUI

// MARK: - Artifact Type

/// Types of artifacts that can be displayed
enum ArtifactType: String, Codable, CaseIterable, Identifiable {
    case code
    case html
    case markdown
    case svg
    case mermaid
    case react

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .code: return "Code"
        case .html: return "HTML"
        case .markdown: return "Markdown"
        case .svg: return "SVG"
        case .mermaid: return "Diagram"
        case .react: return "React"
        }
    }

    var iconName: String {
        switch self {
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .html: return "globe"
        case .markdown: return "doc.text"
        case .svg: return "square.on.square"
        case .mermaid: return "chart.xyaxis.line"
        case .react: return "atom"
        }
    }
}

// MARK: - Artifact Model

/// Model representing an artifact
struct Artifact: Identifiable, Equatable {
    let id: UUID
    let type: ArtifactType
    let title: String
    let content: String
    let language: String?
    let createdAt: Date

    init(
        id: UUID = UUID(),
        type: ArtifactType,
        title: String,
        content: String,
        language: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.content = content
        self.language = language
        self.createdAt = createdAt
    }
}

// MARK: - Artifact Panel

/// Side panel for displaying artifacts (sheet on iPhone, trailing panel on iPad)
struct ArtifactPanel: View {
    let artifacts: [Artifact]
    @Binding var selectedArtifactId: UUID?
    @Binding var isPresented: Bool

    @State private var isFullScreen = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var selectedArtifact: Artifact? {
        artifacts.first { $0.id == selectedArtifactId }
    }

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                // iPhone: Sheet presentation
                sheetContent
            } else {
                // iPad: Side panel
                sidePanelContent
            }
        }
    }

    // MARK: - Sheet Content (iPhone)

    private var sheetContent: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab bar for multiple artifacts
                if artifacts.count > 1 {
                    artifactTabBar
                }

                // Content
                artifactContentView
            }
            .background(Color.theme.background)
            .navigationTitle(selectedArtifact?.title ?? "Artifact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        isPresented = false
                    }
                    .foregroundColor(Color.theme.primary)
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        if let artifact = selectedArtifact {
                            ShareLink(item: artifact.content) {
                                Image(systemName: "square.and.arrow.up")
                            }
                        }

                        Button {
                            isFullScreen.toggle()
                        } label: {
                            Image(systemName: isFullScreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        }
                    }
                    .foregroundColor(Color.theme.foreground)
                }
            }
        }
        .fullScreenCover(isPresented: $isFullScreen) {
            fullScreenArtifactView
        }
    }

    // MARK: - Side Panel Content (iPad)

    private var sidePanelContent: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(selectedArtifact?.title ?? "Artifact")
                    .font(.theme.headline)
                    .foregroundColor(Color.theme.foreground)

                Spacer()

                HStack(spacing: 12) {
                    if let artifact = selectedArtifact {
                        ShareLink(item: artifact.content) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 16))
                        }
                    }

                    Button {
                        isFullScreen.toggle()
                    } label: {
                        Image(systemName: isFullScreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 16))
                    }

                    Button {
                        isPresented = false
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .medium))
                    }
                }
                .foregroundColor(Color.theme.foreground)
            }
            .padding(.horizontal, .spacing.lg)
            .padding(.vertical, .spacing.md)
            .background(Color.theme.backgroundSecondary)

            Divider()
                .background(Color.theme.border)

            // Tab bar
            if artifacts.count > 1 {
                artifactTabBar
            }

            // Content
            artifactContentView
        }
        .background(Color.theme.background)
        .frame(minWidth: 400, idealWidth: 500, maxWidth: 600)
        .fullScreenCover(isPresented: $isFullScreen) {
            fullScreenArtifactView
        }
    }

    // MARK: - Tab Bar

    private var artifactTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .spacing.sm) {
                ForEach(artifacts) { artifact in
                    ArtifactTab(
                        artifact: artifact,
                        isSelected: artifact.id == selectedArtifactId
                    ) {
                        selectedArtifactId = artifact.id
                    }
                }
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
        }
        .background(Color.theme.backgroundSecondary)
    }

    // MARK: - Content View

    @ViewBuilder
    private var artifactContentView: some View {
        if let artifact = selectedArtifact {
            switch artifact.type {
            case .code:
                CodeViewer(
                    code: artifact.content,
                    language: artifact.language ?? "plaintext",
                    title: artifact.title
                )
            case .html:
                HTMLViewer(
                    htmlContent: artifact.content,
                    title: artifact.title
                )
            case .markdown:
                MarkdownArtifactViewer(content: artifact.content)
            case .svg:
                SVGArtifactViewer(svgContent: artifact.content)
            case .mermaid:
                MermaidArtifactViewer(content: artifact.content)
            case .react:
                ReactArtifactViewer(code: artifact.content)
            }
        } else {
            emptyStateView
        }
    }

    // MARK: - Full Screen View

    private var fullScreenArtifactView: some View {
        NavigationStack {
            artifactContentView
                .navigationTitle(selectedArtifact?.title ?? "Artifact")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Done") {
                            isFullScreen = false
                        }
                        .foregroundColor(Color.theme.primary)
                    }

                    ToolbarItem(placement: .navigationBarTrailing) {
                        if let artifact = selectedArtifact {
                            ShareLink(item: artifact.content) {
                                Image(systemName: "square.and.arrow.up")
                            }
                            .foregroundColor(Color.theme.foreground)
                        }
                    }
                }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: .spacing.lg) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            Text("No Artifact Selected")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            Text("Select an artifact from the tabs above to view its content.")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Artifact Tab

struct ArtifactTab: View {
    let artifact: Artifact
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: .spacing.xs) {
                Image(systemName: artifact.type.iconName)
                    .font(.system(size: 12))

                Text(artifact.title)
                    .font(.theme.caption)
                    .lineLimit(1)
            }
            .padding(.horizontal, .spacing.md)
            .padding(.vertical, .spacing.sm)
            .background(isSelected ? Color.theme.primary : Color.theme.backgroundTertiary)
            .foregroundColor(isSelected ? .white : Color.theme.foreground)
            .clipShape(RoundedRectangle(cornerRadius: .radius.sm))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Artifact Preview Card

/// A compact card for showing artifact preview in messages
struct ArtifactPreviewCard: View {
    let artifact: Artifact
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: .spacing.md) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: .radius.sm)
                        .fill(Color.theme.primary.opacity(0.1))
                        .frame(width: 40, height: 40)

                    Image(systemName: artifact.type.iconName)
                        .font(.system(size: 16))
                        .foregroundColor(Color.theme.primary)
                }

                // Info
                VStack(alignment: .leading, spacing: 2) {
                    Text(artifact.title)
                        .font(.theme.callout)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.foreground)
                        .lineLimit(1)

                    Text(artifact.type.displayName)
                        .font(.theme.caption)
                        .foregroundColor(Color.theme.mutedForeground)
                }

                Spacer()

                // Arrow
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12))
                    .foregroundColor(Color.theme.mutedForeground)
            }
            .padding(.spacing.md)
            .background(Color.theme.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: .radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: .radius.md)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Placeholder Viewers

/// Placeholder for Markdown artifact viewer
struct MarkdownArtifactViewer: View {
    let content: String

    var body: some View {
        ScrollView {
            Text(content)
                .font(.theme.body)
                .foregroundColor(Color.theme.foreground)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
    }
}

/// Placeholder for SVG artifact viewer
struct SVGArtifactViewer: View {
    let svgContent: String

    var body: some View {
        VStack {
            Image(systemName: "photo")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            Text("SVG Viewer")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            Text("SVG rendering coming soon")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Placeholder for Mermaid diagram viewer
struct MermaidArtifactViewer: View {
    let content: String

    var body: some View {
        VStack {
            Image(systemName: "chart.xyaxis.line")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            Text("Diagram Viewer")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            Text("Mermaid diagram rendering coming soon")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Placeholder for React component viewer
struct ReactArtifactViewer: View {
    let code: String

    var body: some View {
        VStack {
            Image(systemName: "atom")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.mutedForeground)

            Text("React Viewer")
                .font(.theme.headline)
                .foregroundColor(Color.theme.foreground)

            Text("React component preview coming soon")
                .font(.theme.body)
                .foregroundColor(Color.theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Preview

#if DEBUG
struct ArtifactPanel_Previews: PreviewProvider {
    static var previews: some View {
        ArtifactPanelPreviewContainer()
            .preferredColorScheme(.dark)
    }
}

struct ArtifactPanelPreviewContainer: View {
    @State private var isPresented = true
    @State private var selectedId: UUID?

    let artifacts = [
        Artifact(
            type: .code,
            title: "App.swift",
            content: """
            import SwiftUI

            @main
            struct MyApp: App {
                var body: some Scene {
                    WindowGroup {
                        ContentView()
                    }
                }
            }
            """,
            language: "swift"
        ),
        Artifact(
            type: .html,
            title: "index.html",
            content: "<h1>Hello World</h1>",
            language: "html"
        )
    ]

    var body: some View {
        ZStack {
            Color.theme.background.ignoresSafeArea()

            VStack {
                Text("Main Content")
                    .foregroundColor(.white)

                ArtifactPreviewCard(artifact: artifacts[0]) {
                    selectedId = artifacts[0].id
                    isPresented = true
                }
                .padding()
            }
        }
        .sheet(isPresented: $isPresented) {
            ArtifactPanel(
                artifacts: artifacts,
                selectedArtifactId: $selectedId,
                isPresented: $isPresented
            )
            .presentationDetents([.medium, .large])
        }
        .onAppear {
            selectedId = artifacts.first?.id
        }
    }
}
#endif
