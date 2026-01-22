# iOS Port Plan: vLLM Studio

## Executive Summary

This document outlines the comprehensive plan to port the vLLM Studio web application to a native iOS app using Swift and SwiftUI. The goal is to create a pixel-perfect recreation of the existing web interface with native iOS performance and UX conventions.

---

## 1. Project Overview

### Source Application
- **Framework**: Next.js 16 + React 19
- **Styling**: Tailwind CSS 4 with dark theme
- **State Management**: Zustand
- **Real-time**: WebSocket/SSE for streaming
- **API**: REST with Bearer token auth

### Target Platform
- **Language**: Swift 6
- **UI Framework**: SwiftUI (iOS 17+)
- **Minimum iOS**: 17.0
- **Devices**: iPhone and iPad (Universal)

---

## 2. Feature Parity Matrix

| Web Feature | iOS Implementation | Priority |
|-------------|-------------------|----------|
| Dashboard | SwiftUI View + Real-time updates | P0 |
| Chat (full) | Native chat UI with streaming | P0 |
| Recipes | List/Detail with CRUD | P0 |
| Logs | Log viewer with filtering | P1 |
| Usage Analytics | Charts with Swift Charts | P1 |
| Configs | Settings screen | P1 |
| Discover | Model browser | P2 |
| MCP Tools | Tool calling integration | P1 |
| Artifacts | Code/HTML viewer | P1 |
| Voice Input | iOS Speech framework | P2 |

**Priority Key**: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## 3. Technical Architecture

### 3.1 Project Structure

```
iOS/
├── vLLMStudio.xcodeproj
├── vLLMStudio/
│   ├── App/
│   │   ├── vLLMStudioApp.swift          # App entry point
│   │   ├── ContentView.swift             # Root navigation
│   │   └── AppDelegate.swift             # App lifecycle
│   │
│   ├── Core/
│   │   ├── Network/
│   │   │   ├── APIClient.swift           # HTTP client with retry logic
│   │   │   ├── APIEndpoints.swift        # Endpoint definitions
│   │   │   ├── WebSocketManager.swift    # Real-time connections
│   │   │   ├── SSEClient.swift           # Server-sent events for chat
│   │   │   └── NetworkError.swift        # Error types
│   │   │
│   │   ├── Storage/
│   │   │   ├── KeychainManager.swift     # Secure API key storage
│   │   │   ├── UserDefaultsManager.swift # App preferences
│   │   │   └── CoreDataManager.swift     # Local persistence (sessions)
│   │   │
│   │   ├── Services/
│   │   │   ├── AuthService.swift         # API key management
│   │   │   ├── ChatService.swift         # Chat operations
│   │   │   ├── RecipeService.swift       # Recipe CRUD
│   │   │   ├── ModelService.swift        # Model lifecycle
│   │   │   ├── LogService.swift          # Log fetching
│   │   │   ├── UsageService.swift        # Analytics data
│   │   │   └── MCPService.swift          # MCP tool integration
│   │   │
│   │   └── Utilities/
│   │       ├── Extensions/               # Swift extensions
│   │       ├── Helpers/                  # Utility functions
│   │       └── Constants.swift           # App constants
│   │
│   ├── Features/
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift
│   │   │   ├── DashboardViewModel.swift
│   │   │   ├── Components/
│   │   │   │   ├── GPUStatusCard.swift
│   │   │   │   ├── MetricsGrid.swift
│   │   │   │   ├── QuickLaunchSection.swift
│   │   │   │   └── RecentLogsCard.swift
│   │   │   └── Models/
│   │   │       └── DashboardModels.swift
│   │   │
│   │   ├── Chat/
│   │   │   ├── ChatView.swift            # Main chat screen
│   │   │   ├── ChatViewModel.swift       # Chat state & logic
│   │   │   ├── Components/
│   │   │   │   ├── MessageList/
│   │   │   │   │   ├── MessageListView.swift
│   │   │   │   │   ├── MessageBubble.swift
│   │   │   │   │   ├── UserMessage.swift
│   │   │   │   │   └── AssistantMessage.swift
│   │   │   │   ├── Input/
│   │   │   │   │   ├── ChatInputBar.swift
│   │   │   │   │   ├── ToolBelt.swift
│   │   │   │   │   └── AttachmentPicker.swift
│   │   │   │   ├── Artifacts/
│   │   │   │   │   ├── ArtifactPanel.swift
│   │   │   │   │   ├── CodeViewer.swift
│   │   │   │   │   └── HTMLViewer.swift
│   │   │   │   ├── Code/
│   │   │   │   │   ├── CodeBlock.swift
│   │   │   │   │   └── SyntaxHighlighter.swift
│   │   │   │   ├── Thinking/
│   │   │   │   │   └── ThinkingBlock.swift
│   │   │   │   └── SessionList/
│   │   │   │       ├── SessionSidebar.swift
│   │   │   │       └── SessionRow.swift
│   │   │   ├── Modals/
│   │   │   │   ├── ChatSettingsSheet.swift
│   │   │   │   ├── MCPSettingsSheet.swift
│   │   │   │   ├── UsageSheet.swift
│   │   │   │   └── ExportSheet.swift
│   │   │   └── Models/
│   │   │       ├── ChatSession.swift
│   │   │       ├── Message.swift
│   │   │       └── Artifact.swift
│   │   │
│   │   ├── Recipes/
│   │   │   ├── RecipesView.swift
│   │   │   ├── RecipesViewModel.swift
│   │   │   ├── Components/
│   │   │   │   ├── RecipeRow.swift
│   │   │   │   ├── RecipeDetailView.swift
│   │   │   │   ├── RecipeEditor/
│   │   │   │   │   ├── RecipeEditorSheet.swift
│   │   │   │   │   ├── FormModeEditor.swift
│   │   │   │   │   └── CommandModeEditor.swift
│   │   │   │   └── VRAMCalculator.swift
│   │   │   └── Models/
│   │   │       └── Recipe.swift
│   │   │
│   │   ├── Logs/
│   │   │   ├── LogsView.swift
│   │   │   ├── LogsViewModel.swift
│   │   │   ├── Components/
│   │   │   │   ├── LogSessionList.swift
│   │   │   │   ├── LogContentView.swift
│   │   │   │   └── LogFilterBar.swift
│   │   │   └── Models/
│   │   │       └── LogEntry.swift
│   │   │
│   │   ├── Usage/
│   │   │   ├── UsageView.swift
│   │   │   ├── UsageViewModel.swift
│   │   │   ├── Components/
│   │   │   │   ├── MetricsOverview.swift
│   │   │   │   ├── UsageChart.swift
│   │   │   │   └── ModelPerformanceTable.swift
│   │   │   └── Models/
│   │   │       └── UsageMetrics.swift
│   │   │
│   │   ├── Configs/
│   │   │   ├── ConfigsView.swift
│   │   │   ├── ConfigsViewModel.swift
│   │   │   └── Components/
│   │   │       ├── APIKeySection.swift
│   │   │       └── ConnectionTestButton.swift
│   │   │
│   │   └── Discover/
│   │       ├── DiscoverView.swift
│   │       ├── DiscoverViewModel.swift
│   │       ├── Components/
│   │       │   ├── ModelCard.swift
│   │       │   ├── FilterBar.swift
│   │       │   └── SearchBar.swift
│   │       └── Models/
│   │           └── DiscoverModel.swift
│   │
│   ├── Shared/
│   │   ├── Components/
│   │   │   ├── Navigation/
│   │   │   │   ├── TabBar.swift
│   │   │   │   ├── Sidebar.swift
│   │   │   │   └── NavigationHeader.swift
│   │   │   ├── UI/
│   │   │   │   ├── LoadingView.swift
│   │   │   │   ├── ErrorView.swift
│   │   │   │   ├── EmptyStateView.swift
│   │   │   │   ├── RefreshButton.swift
│   │   │   │   ├── StatusBadge.swift
│   │   │   │   └── ChangeIndicator.swift
│   │   │   ├── Markdown/
│   │   │   │   ├── MarkdownView.swift
│   │   │   │   └── MarkdownParser.swift
│   │   │   └── Charts/
│   │   │       └── LineChartView.swift
│   │   │
│   │   ├── Styles/
│   │   │   ├── Theme.swift              # Color palette & typography
│   │   │   ├── ButtonStyles.swift
│   │   │   ├── TextStyles.swift
│   │   │   └── CardStyles.swift
│   │   │
│   │   └── ViewModifiers/
│   │       ├── CardModifier.swift
│   │       └── ShimmerModifier.swift
│   │
│   ├── Resources/
│   │   ├── Assets.xcassets/
│   │   │   ├── AppIcon.appiconset/
│   │   │   ├── Colors/
│   │   │   └── Images/
│   │   ├── Fonts/
│   │   │   └── Geist/                   # Match web font
│   │   └── Localizable.strings
│   │
│   └── Preview Content/
│       └── PreviewData.swift
│
├── vLLMStudioTests/
│   ├── NetworkTests/
│   ├── ServiceTests/
│   └── ViewModelTests/
│
└── vLLMStudioUITests/
    └── FlowTests/
```

### 3.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| UI | SwiftUI | Native, declarative, matches React mental model |
| State | @Observable (Observation framework) | Modern Swift 5.9+, cleaner than Combine |
| Networking | URLSession + async/await | Native, no dependencies needed |
| WebSocket | URLSessionWebSocketTask | Built-in WebSocket support |
| Persistence | SwiftData | Modern replacement for Core Data |
| Keychain | KeychainAccess (SPM) | Secure API key storage |
| Charts | Swift Charts | Native Apple framework |
| Markdown | swift-markdown + AttributedString | Native rendering |
| Syntax Highlighting | Splash or custom | Code block highlighting |
| Animations | SwiftUI animations | Match Framer Motion effects |

### 3.3 State Management Architecture

```swift
// Global App State (Observable pattern)
@Observable
final class AppState {
    // Authentication
    var apiKey: String?
    var isAuthenticated: Bool { apiKey != nil }

    // Connection
    var serverStatus: ServerStatus = .disconnected
    var gpuMetrics: [GPUMetric] = []

    // Navigation
    var selectedTab: Tab = .dashboard
    var chatSidebarVisible: Bool = true
}

// Feature-specific ViewModels
@Observable
final class ChatViewModel {
    var sessions: [ChatSession] = []
    var currentSessionId: UUID?
    var messages: [Message] = []
    var isStreaming: Bool = false
    var mcpServers: [MCPServer] = []
    // ... etc
}
```

---

## 4. Design System

### 4.1 Color Palette (Matching Web)

```swift
extension Color {
    static let theme = ThemeColors()
}

struct ThemeColors {
    // Backgrounds
    let background = Color(hex: "#0d0d0d")
    let backgroundSecondary = Color(hex: "#1b1b1b")
    let backgroundTertiary = Color(hex: "#1f1f1f")
    let card = Color(hex: "#171717")

    // Text
    let foreground = Color(hex: "#e8e6e3")
    let mutedForeground = Color(hex: "#9a9088")

    // Accent
    let primary = Color(hex: "#d97706")  // Orange
    let primaryHover = Color(hex: "#ea580c")

    // Status
    let success = Color(hex: "#15803d")
    let error = Color(hex: "#dc2626")
    let warning = Color(hex: "#d97706")

    // Border
    let border = Color(hex: "#2d2d2d")
}
```

### 4.2 Typography

```swift
extension Font {
    static let theme = ThemeFonts()
}

struct ThemeFonts {
    // Using system font that matches Geist characteristics
    let title = Font.system(size: 24, weight: .semibold, design: .default)
    let headline = Font.system(size: 18, weight: .semibold)
    let body = Font.system(size: 14, weight: .regular)
    let caption = Font.system(size: 12, weight: .regular)
    let code = Font.system(size: 13, weight: .regular, design: .monospaced)
}
```

### 4.3 Component Mapping

| Web Component | iOS Equivalent |
|---------------|----------------|
| Sidebar navigation | TabView + NavigationSplitView |
| Modal sheets | .sheet() modifier |
| Dropdown menus | Menu or Picker |
| Toast notifications | Custom overlay or .alert() |
| Code blocks | Custom view with syntax highlighting |
| Markdown | MarkdownUI or AttributedString |
| Charts | Swift Charts |
| Loading spinners | ProgressView |
| Buttons | Button with custom styles |

---

## 5. API Integration

### 5.1 Network Layer

```swift
actor APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let maxRetries = 3

    func request<T: Decodable>(
        _ endpoint: Endpoint,
        retries: Int = 3
    ) async throws -> T {
        // Exponential backoff retry logic
        // Bearer token injection
        // Error handling
    }

    func stream(
        _ endpoint: Endpoint
    ) -> AsyncThrowingStream<Data, Error> {
        // SSE streaming for chat
    }
}
```

### 5.2 Endpoint Definitions

```swift
enum Endpoint {
    // Health & Status
    case health
    case status
    case gpus
    case metrics

    // Recipes
    case recipes
    case recipe(id: String)
    case createRecipe
    case updateRecipe(id: String)
    case deleteRecipe(id: String)

    // Model Lifecycle
    case launch(recipeId: String)
    case evict
    case waitReady
    case models

    // Chat
    case chatSessions
    case chatSession(id: String)
    case chatMessages(sessionId: String)
    case createMessage(sessionId: String)
    case forkSession(id: String, messageIndex: Int)

    // MCP
    case mcpServers
    case mcpTools(serverId: String)
    case executeTool(serverId: String, toolName: String)

    // Logs
    case logSessions
    case logContent(sessionId: String)

    // Usage
    case usageStats
    case peakMetrics
}
```

### 5.3 Real-time Connections

```swift
// WebSocket for GPU metrics and launch progress
final class WebSocketManager: ObservableObject {
    func connect(to url: URL)
    func disconnect()
    func send(_ message: WSMessage)
    var onMessage: ((WSMessage) -> Void)?
}

// SSE for chat streaming
final class SSEClient {
    func stream(url: URL) -> AsyncThrowingStream<SSEEvent, Error>
}
```

---

## 6. Feature Implementation Details

### 6.1 Dashboard

**Components:**
- GPU status cards with real-time metrics
- System health indicators
- Quick launch buttons for pinned recipes
- Recent logs preview
- Connection status badge

**Real-time Updates:**
- WebSocket connection for GPU metrics
- Polling fallback every 5 seconds
- Animated value changes

### 6.2 Chat (Most Complex Feature)

**Core Features:**
- Session list sidebar (iPad: split view, iPhone: sheet)
- Message list with auto-scroll
- Streaming text with typing indicator
- Code blocks with syntax highlighting
- Thinking/reasoning collapsible sections
- MCP tool calling and results
- Artifacts panel (slide-over on iPhone)

**Input Features:**
- Multi-line text input
- File attachments (images, documents)
- Voice input (Speech framework)
- Tool selection menu

**Session Management:**
- Create/rename/delete sessions
- Fork conversation at any point
- Export conversation (share sheet)
- Token usage tracking

**Streaming Implementation:**
```swift
func streamMessage(prompt: String) async {
    isStreaming = true
    defer { isStreaming = false }

    for try await chunk in apiClient.stream(.chat(prompt)) {
        await MainActor.run {
            currentMessage.content += chunk.text
            // Parse artifacts, thinking blocks, etc.
        }
    }
}
```

### 6.3 Recipes

**List View:**
- Searchable list with status badges
- Swipe actions (pin, delete)
- Pull to refresh
- Sorting options

**Editor:**
- Form mode with sections:
  - Model loading parameters
  - Parallelism settings
  - Memory & KV cache
  - Performance tuning
  - Tool calling config
- Command mode (raw text editor)
- VRAM calculator tool

### 6.4 Logs

**Features:**
- Session list with date grouping
- Log content viewer with monospace font
- Keyword filtering
- Auto-refresh toggle
- Share/export functionality

### 6.5 Usage Analytics

**Charts:**
- Daily usage line chart (Swift Charts)
- Model breakdown pie chart
- Performance metrics table

**Metrics:**
- Total requests/tokens/cost
- Per-model statistics
- Peak usage tracking

### 6.6 Configs

**Sections:**
- API key management (secure input)
- Server URL configuration
- Connection test button
- System info display

### 6.7 Discover

**Features:**
- Model search and browse
- Filter by task type
- Filter by provider
- Sort by popularity/size
- Model details sheet

---

## 7. Navigation Architecture

### iPhone Layout
```
TabView
├── Dashboard
├── Chat (with sheet for sessions)
├── Recipes
├── More
    ├── Logs
    ├── Usage
    ├── Configs
    └── Discover
```

### iPad Layout
```
NavigationSplitView
├── Sidebar (all sections)
├── Detail View
└── (Chat gets NavigationSplitView nested for sessions)
```

---

## 8. Data Persistence

### Local Storage Strategy

| Data | Storage | Rationale |
|------|---------|-----------|
| API Key | Keychain | Security |
| User Preferences | UserDefaults | Simple key-value |
| Chat Sessions | SwiftData | Complex relationships |
| Pinned Recipes | UserDefaults | Simple array |
| Cached Models | FileManager | Large data |

### SwiftData Models

```swift
@Model
final class ChatSession {
    @Attribute(.unique) var id: UUID
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var modelId: String
    var systemPrompt: String?
    @Relationship(deleteRule: .cascade) var messages: [Message]
}

@Model
final class Message {
    @Attribute(.unique) var id: UUID
    var role: MessageRole
    var content: String
    var createdAt: Date
    var tokenCount: Int?
    var artifacts: [Artifact]?
    var toolCalls: [ToolCall]?
}
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup with Xcode
- [ ] Design system implementation (colors, typography, components)
- [ ] Network layer with APIClient
- [ ] Authentication/API key management
- [ ] Basic navigation structure
- [ ] Dashboard view (static mockup)

### Phase 2: Core Features (Week 3-5)
- [ ] Dashboard with real-time data
- [ ] Recipes list and detail views
- [ ] Recipe editor (form mode)
- [ ] Model launch/stop functionality
- [ ] Basic chat UI (no streaming yet)

### Phase 3: Chat System (Week 6-8)
- [ ] Chat session management
- [ ] Message list with proper rendering
- [ ] Streaming implementation (SSE)
- [ ] Code block syntax highlighting
- [ ] Thinking block rendering
- [ ] Markdown rendering

### Phase 4: Advanced Chat (Week 9-10)
- [ ] MCP tool integration
- [ ] Artifact system
- [ ] Session forking
- [ ] Export functionality
- [ ] Voice input

### Phase 5: Supporting Features (Week 11-12)
- [ ] Logs viewer
- [ ] Usage analytics with charts
- [ ] Discover page
- [ ] Configs page
- [ ] Widget extensions (optional)

### Phase 6: Polish (Week 13-14)
- [ ] Animations and transitions
- [ ] Error handling improvements
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Testing coverage
- [ ] App Store preparation

---

## 10. Dependencies (Swift Package Manager)

```swift
// Package.swift dependencies
dependencies: [
    // Keychain access
    .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.0"),

    // Markdown rendering
    .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.0.0"),

    // Syntax highlighting
    .package(url: "https://github.com/JohnSundell/Splash", from: "0.16.0"),

    // Networking utilities (optional, can use native)
    // .package(url: "https://github.com/Alamofire/Alamofire", from: "5.8.0"),
]
```

---

## 11. Testing Strategy

### Unit Tests
- Network layer mocking
- ViewModel logic
- Data parsing
- Service methods

### UI Tests
- Navigation flows
- Form validation
- Chat message rendering
- Error states

### Integration Tests
- API endpoint testing
- WebSocket connection
- Data persistence

---

## 12. App Store Considerations

### Required Assets
- App icon (1024x1024 + all sizes)
- Screenshots (6.7", 6.5", 5.5" iPhone + iPad)
- App description and keywords
- Privacy policy URL

### Capabilities Needed
- Network access
- Keychain access
- Speech recognition (if voice input)
- Background fetch (optional)

### Privacy
- No user tracking
- Local data storage only
- API key stored in Keychain
- Clear data on logout option

---

## 13. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Complex chat streaming | Thorough SSE client testing |
| Code highlighting performance | Lazy loading, caching |
| Large message histories | Pagination, virtualization |
| WebSocket reliability | Reconnection logic, fallback polling |
| Cross-device sync | Out of scope for v1 |

---

## 14. Success Criteria

1. **Feature Parity**: All P0 and P1 features working
2. **Performance**: 60fps scrolling, <100ms response
3. **Reliability**: No crashes, graceful error handling
4. **Design**: Pixel-perfect match to web UI
5. **Code Quality**: 70%+ test coverage, clean architecture

---

## 15. Open Questions for Review

1. **iPad Layout**: Should we use a persistent sidebar or collapsible?
2. **Offline Mode**: Should messages be cached for offline viewing?
3. **Push Notifications**: Needed for model launch completion?
4. **Widgets**: Dashboard metrics widget for home screen?
5. **Shortcuts**: Siri shortcuts for quick actions?

---

## Appendix A: Screen Mockups Reference

The iOS app should match these web screens:
- Dashboard: Dark cards with GPU stats, orange accent buttons
- Chat: Full-width messages, sidebar for sessions
- Recipes: Table view with status badges
- All screens: Dark theme (#0d0d0d background)

## Appendix B: API Contract

All API endpoints follow the same contract as the web app:
- Base URL: Configurable (default: `http://localhost:8080`)
- Auth: Bearer token in Authorization header
- Format: JSON request/response
- Streaming: SSE for chat completions

---

*Document created: 2026-01-22*
*Last updated: 2026-01-22*
*Version: 1.0*
