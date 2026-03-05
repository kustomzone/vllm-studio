// CRITICAL
import Foundation

enum ChatFlowPhase: Equatable, CustomStringConvertible {
  case idle
  case preparing
  case streaming
  case awaitingToolResults
  case updatingTitle
  case completed
  case failed(String)
  case cancelled

  var isBusy: Bool {
    switch self {
    case .preparing, .streaming, .awaitingToolResults, .updatingTitle:
      return true
    default:
      return false
    }
  }

  var description: String {
    switch self {
    case .idle: return "idle"
    case .preparing: return "preparing"
    case .streaming: return "streaming"
    case .awaitingToolResults: return "awaitingToolResults"
    case .updatingTitle: return "updatingTitle"
    case .completed: return "completed"
    case .failed(let reason): return "failed(\(reason))"
    case .cancelled: return "cancelled"
    }
  }
}

enum ChatFlowEvent {
  case reset
  case startTurn
  case streamStarted
  case assistantReturnedNoTools
  case assistantReturnedTools
  case toolRoundComplete
  case toolRoundLimitReached
  case titleUpdateStarted
  case titleUpdated
  case failure(String)
  case cancel
}

enum ChatFlowStateMachine {
  static func reduce(_ state: ChatFlowPhase, event: ChatFlowEvent) -> ChatFlowPhase {
    switch state {
    case .idle:
      switch event {
      case .startTurn:
        return .preparing
      case .reset:
        return .idle
      default:
        return state
      }

    case .completed:
      switch event {
      case .startTurn:
        return .preparing
      case .reset:
        return .idle
      default:
        return state
      }

    case .failed:
      switch event {
      case .startTurn:
        return .preparing
      case .failure(let message):
        return .failed(message)
      case .cancel:
        return .cancelled
      case .reset:
        return .idle
      default:
        return state
      }

    case .cancelled:
      switch event {
      case .startTurn:
        return .preparing
      case .cancel:
        return .cancelled
      case .reset:
        return .idle
      default:
        return state
      }

    case .preparing:
      switch event {
      case .streamStarted:
        return .streaming
      case .failure(let message):
        return .failed(message)
      case .cancel:
        return .cancelled
      default:
        return state
      }

    case .streaming:
      switch event {
      case .assistantReturnedTools:
        return .awaitingToolResults
      case .assistantReturnedNoTools:
        return .updatingTitle
      case .failure(let message):
        return .failed(message)
      case .cancel:
        return .cancelled
      default:
        return state
      }

    case .awaitingToolResults:
      switch event {
      case .toolRoundComplete:
        return .preparing
      case .toolRoundLimitReached:
        return .updatingTitle
      case .failure(let message):
        return .failed(message)
      case .cancel:
        return .cancelled
      default:
        return state
      }

    case .updatingTitle:
      switch event {
      case .titleUpdateStarted:
        return .updatingTitle
      case .titleUpdated:
        return .completed
      case .failure(let message):
        return .failed(message)
      case .cancel:
        return .cancelled
      default:
        return state
      }
    }
  }

  static func transition(_ state: ChatFlowPhase, with event: ChatFlowEvent) -> ChatFlowPhase {
    reduce(state, event: event)
  }
}
