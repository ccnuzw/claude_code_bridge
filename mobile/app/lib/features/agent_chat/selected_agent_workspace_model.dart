import '../../models/ccb_agent.dart';
import '../../models/ccb_content_item.dart';
import '../../models/ccb_conversation_item.dart';
import '../../models/ccb_project_view.dart';
import '../../models/readable_terminal_history.dart';
import 'agent_chat_controller.dart';
import 'agent_execution_status.dart';

export 'agent_execution_status.dart';

class SelectedAgentWorkspaceModel {
  const SelectedAgentWorkspaceModel({
    required this.agent,
    this.contentItems = const [],
    this.initialHistory,
    required this.timelineItems,
    this.commsItems = const [],
    required this.isLoadingConversation,
    required this.hasOlderConversation,
    required this.expandedItemIds,
    required this.hasNewMessages,
    required this.isSending,
    required this.isAwaitingAgentResponse,
    required this.isComposerCollapsed,
    required this.executionStatus,
    this.workingReplyItemId,
  });

  final CcbAgent agent;
  final List<CcbContentItem> contentItems;
  final ReadableTerminalHistory? initialHistory;
  final List<CcbConversationItem> timelineItems;
  final List<CcbConversationItem> commsItems;
  final bool isLoadingConversation;
  final bool hasOlderConversation;
  final Set<String> expandedItemIds;
  final bool hasNewMessages;
  final bool isSending;
  final bool isAwaitingAgentResponse;
  final bool isComposerCollapsed;
  final AgentExecutionStatus? executionStatus;
  final String? workingReplyItemId;
}

SelectedAgentWorkspaceModel selectedAgentWorkspaceModel({
  required CcbProjectView view,
  required CcbAgent agent,
  required AgentChatController chatController,
  required bool isAwaitingAgentResponse,
  bool hasLocalExecutionException = false,
}) {
  final remoteConversation = chatController.remoteConversationFor(agent.name);
  final isLoadingConversation = chatController.isLoadingConversation(
    agent.name,
  );
  final executionStatus = agentExecutionStatus(
    agent: agent,
    isAwaitingAgentResponse: isAwaitingAgentResponse,
    hasLocalExecutionException: hasLocalExecutionException,
  );
  final timelineItems = [
    // Chat is deliberately limited to provider/native history plus local
    // optimistic user messages. Terminal history is an explicit fallback.
    if (remoteConversation != null)
      for (final item in remoteConversation.items)
        if (_isDefaultChatRemoteItem(item))
          chatController.presentationItemFor(agent.name, item),
    ...chatController.localMessagesFor(agent.name),
  ];
  final workingReplyItemId =
      executionStatus.state == 'working'
          ? selectedAgentWorkingReplyItemId(timelineItems)
          : null;
  final visibleTimelineItems =
      workingReplyItemId == null && executionStatus.state == 'working'
          ? [
            ...timelineItems,
            syntheticAgentWorkingConversationItem(
              agent.name,
              startedAt: _latestUserSentAt(timelineItems),
            ),
          ]
          : timelineItems;
  final visibleWorkingReplyItemId =
      workingReplyItemId ??
      (executionStatus.state == 'working'
          ? syntheticAgentWorkingConversationItemId(agent.name)
          : null);
  return SelectedAgentWorkspaceModel(
    agent: agent,
    contentItems: view.contentForAgent(agent.name),
    initialHistory: null,
    timelineItems: visibleTimelineItems,
    commsItems: [
      if (remoteConversation != null)
        for (final item in remoteConversation.items)
          if (item.kind == CcbConversationItemKind.commsItem) item,
    ],
    isLoadingConversation: isLoadingConversation,
    hasOlderConversation: chatController.hasOlderConversation(agent.name),
    expandedItemIds: chatController.expandedItemIds(agent.name),
    hasNewMessages: chatController.hasNewMessages(agent.name),
    isSending: chatController.isSubmitting(agent.name),
    isAwaitingAgentResponse: isAwaitingAgentResponse,
    isComposerCollapsed: chatController.isComposerCollapsed(agent.name),
    executionStatus: executionStatus,
    workingReplyItemId: visibleWorkingReplyItemId,
  );
}

String syntheticAgentWorkingConversationItemId(String agentName) =>
    'synthetic-working-reply-$agentName';

CcbConversationItem syntheticAgentWorkingConversationItem(
  String agentName, {
  DateTime? startedAt,
}) {
  return CcbConversationItem(
    id: syntheticAgentWorkingConversationItemId(agentName),
    agentName: agentName,
    kind: CcbConversationItemKind.agentReply,
    title: 'Agent reply',
    body: 'Working...',
    source: 'project_view',
    startedAt: startedAt,
  );
}

DateTime? _latestUserSentAt(List<CcbConversationItem> items) {
  for (final item in items.reversed) {
    if (item.kind == CcbConversationItemKind.userMessage) {
      return item.sentAt;
    }
  }
  return null;
}

String? selectedAgentWorkingReplyItemId(List<CcbConversationItem> items) {
  CcbConversationItem? latestUser;
  CcbConversationItem? latestReply;
  for (final item in items) {
    if (item.kind == CcbConversationItemKind.userMessage) {
      latestUser = item;
    } else if (item.kind == CcbConversationItemKind.agentReply) {
      latestReply = item;
    }
  }
  if (latestReply == null) {
    return null;
  }
  if (latestReply.completedAt != null) {
    return null;
  }
  final replyStartedAt = latestReply.startedAt ?? latestReply.sentAt;
  final userSentAt = latestUser?.sentAt;
  if (replyStartedAt == null) {
    if (latestUser != null) {
      return null;
    }
    return _isCurrentTurnReplyCandidate(latestReply) ? latestReply.id : null;
  }
  if (userSentAt != null && replyStartedAt.isBefore(userSentAt)) {
    return null;
  }
  return _isCurrentTurnReplyCandidate(latestReply) ? latestReply.id : null;
}

bool _isCurrentTurnReplyCandidate(CcbConversationItem item) {
  final source = item.source ?? '';
  return source.isEmpty || source.startsWith('provider_native/');
}

bool _isDefaultChatRemoteItem(CcbConversationItem item) {
  if (item.kind == CcbConversationItemKind.commsItem) {
    return false;
  }
  final source = item.source ?? '';
  return !source.startsWith('tmux output') &&
      !source.startsWith('terminal ') &&
      !source.startsWith('tmux scrollback');
}
