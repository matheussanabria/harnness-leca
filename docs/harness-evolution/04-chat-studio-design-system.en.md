# Chat, Studio, and Design System

Português: [Chat, Studio e Design System](04-chat-studio-design-system.md).

> This translation preserves the document's historical and planned claims as written; they have not been revalidated.

## Universal chat

Keep `chat.js` as the facade. Extract a controller configured by `ChatPresentation` from `chat-ui-interaction.js`; retain the old wrappers until migration is complete.

1. Characterize the modal, Studio, and mini widget.
2. Centralize opening/closing, outside clicks, Escape, and focus.
3. Consolidate the store by `chatId + projectSlug`.
4. Migrate the modal, Studio, and mini widget in that order.
5. Remove wrappers after parity.

Uploads, skills, memories, permissions, comparison, and DAI are capabilities of the same composer. Context is provided through validated references; the server resolves only authorized fields.

## Studio

- Reuse Chat Core/UI with an embedded adapter.
- Use Pointer Events and keyboard resizing.
- Turn 300/850 px and the 768 px breakpoint into tokens.
- Persist the ratio with clamping on another screen.
- Do not reload the iframe when resizing; switch between preview and chat when narrow.
- Use `ResizeObserver` for presentation only; the conversation is independent of size.

## Foundations

Consolidate spacing and typography scales; focus; named layers; breakpoints at 375, 640, 768, 1024, 1440, and 1920; panel limits; touch targets; and statuses that do not rely on color alone.

Priority: Button, IconButton, Popover, Modal, Drawer, Tabs, SplitPanel, ChatHeader, ChatComposer, KanbanLane, and StoryCard. Reuse partials/styles that meet the criteria.

## Acceptance

- Escape closes only the top layer and restores focus.
- Clicking outside closes it; internal interaction does not.
- One menu open per presentation.
- History, streaming, and draft survive layout changes.
- Resizing works with mouse, touch, and keyboard, without reloading the preview.
- No critical control falls outside the six viewports.
- Simultaneous chats do not mix sessions, abort controllers, attachments, or context.

## Harness evolution program

[Program overview](README.en.md) · [01 Current-state audit](01-current-state-audit.en.md) · [02 Requirements and gaps](02-requirements-and-gaps.en.md) · [03 Target architecture](03-target-architecture.en.md) · [04 Chat, Studio, and Design System](04-chat-studio-design-system.en.md) · [05 Product domains](05-product-domains.en.md) · [06 Data, security, and tests](06-data-security-tests.en.md) · [07 Roadmap, risks, and acceptance](07-roadmap-risks-acceptance.en.md) · [08 Prioritized backlog](08-prioritized-backlog.en.md)
