import Foundation

extension ChatDetailViewModel {
  func sendMessage(attachments: [ChatAttachment] = []) async {
    guard let api else { return }

    if chatFlowPhase.isBusy {
      activeStreamTask?.cancel()
      transition(.cancel)
    }

    let content = input.trimmingCharacters(in: .whitespacesAndNewlines)
    let attachmentText = formatAttachments(attachments)
    let combined = [content, attachmentText].filter { !$0.isEmpty }.joined(separator: "\n")
    guard !combined.isEmpty else { return }

    transition(.startTurn)
    error = nil
    input = ""

    let user = StoredMessage(id: UUID().uuidString, role: "user", content: combined, model: nil, toolCalls: nil)
    messages.append(user)
    _ = try? await api.addMessage(sessionId: sessionId, message: user)

    let streamTask = Task { [weak self] in
      guard let self else { return }
      await self.streamTurn(api: api, userContent: combined)
    }
    activeStreamTask = streamTask
    await streamTask.value
    activeStreamTask = nil

    if let usage = try? await api.getChatUsage(sessionId: sessionId) {
      chatUsage = usage
    } else {
      refreshUsageSnapshot()
    }
  }

  func transition(_ event: ChatFlowEvent) {
    chatFlowPhase = ChatFlowStateMachine.transition(chatFlowPhase, with: event)
  }

  private func formatAttachments(_ attachments: [ChatAttachment]) -> String {
    attachments.map { attachment in
      switch attachment.type {
      case .image: return "[Image: \(attachment.name)]"
      case .file: return "[File: \(attachment.name)]"
      case .audio: return "[Audio: \(attachment.name)]"
      }
    }.joined(separator: "\n")
  }
}
