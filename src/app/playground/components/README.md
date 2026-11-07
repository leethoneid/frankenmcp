# Playground Chat Components

The Playground Chat (`/playground`) provides an interactive testing interface for FrankenMCP's dynamic router. It allows developers and judges to submit natural language queries, inspect real-time server routing decisions, view tool arguments and outputs, and observe token savings in action.

---

## Architecture & Hierarchy

The Playground is structured with a Next.js Server Component page as the entry point, delegating state orchestration to client-side components and communicating with the backend exclusively via `POST /api/playground/chat`.

```
src/app/playground/page.tsx (Server Component)
├── Header ("🎮 Playground", "Test dynamic tool routing in real time")
└── Main
    └── <ChatContainer /> (Client Component - State & API Orchestrator)
        ├── <ConversationHistory /> (Scrollable container & auto-scroll)
        │   ├── Empty state:
        │   │   └── <WelcomeMessage /> (Onboarding & 3 clickable server examples)
        │   │
        │   ├── Conversation turns:
        │   │   └── <TurnDisplay /> (Per-turn card)
        │   │       ├── User Query & Timestamp
        │   │       ├── Server Warnings banner (if servers offline/skipped)
        │   │       ├── <RoutingStatsCard /> (Servers, tools loaded/trimmed, tokens saved)
        │   │       ├── <LoadingIndicator message="Executing tools..." /> (when executing)
        │   │       ├── Tool Results:
        │   │       │   └── <ToolResultCard /> (Formatted JSON, success/error styling, collapsible)
        │   │       └── <ErrorMessage /> (if turn-level error occurs)
        │   │
        │   └── In-flight loading:
        │       └── <LoadingIndicator message="Routing your query..." />
        │
        └── <InputBar /> (Validation, submit button, disabled states, auto-focus ref)
```

---

## Data Flow & API Boundary

To comply with **Military Rule 2 (Zero regression)** and architectural separation of concerns:
- **Client Side (`ChatContainer.tsx`)**: Strictly manages UI state (`turns`, `isProcessing`, `loadingPhase`, `inputValue`). Never imports `routeIntent`, `MCPServerManager`, or `recordTurn` directly.
- **API Boundary (`POST /api/playground/chat`)**: Receives `{ query: string }`, ensures live demo MCP servers are connected via `ensureServersInitialized()`, routes through `routeIntent()` (which auto-records turns to `getSessionStats()` for `/lab`), parses arguments with `extractToolArguments()`, executes tools via `MCPServerManager.invokeToolCall()`, and returns the constructed `Turn` JSON payload.

---

## Reusable Components & Usage Examples

### 1. ErrorMessage (`ErrorMessage.tsx`)
A standardized accessible error banner for displaying tool execution failures, routing errors, or missing tool notices.

#### Props
```typescript
interface ErrorMessageProps {
  /** The error text or explanation to display to the user. */
  message: string;
}
```

#### Usage Example
```tsx
import ErrorMessage from '@/app/playground/components/ErrorMessage';

export function ExampleError() {
  return (
    <ErrorMessage message="No relevant tools found for query: 'What is the weather today?'" />
  );
}
```

---

### 2. LoadingIndicator (`LoadingIndicator.tsx`)
An animated purple spinner with contextual explanatory text indicating asynchronous routing or tool invocation phases.

#### Props
```typescript
interface LoadingIndicatorProps {
  /** Optional custom status message describing current background work (default: 'Routing...'). */
  message?: string;
}
```

#### Usage Example
```tsx
import LoadingIndicator from '@/app/playground/components/LoadingIndicator';

export function ExampleLoading() {
  return (
    <div className="space-y-4">
      <LoadingIndicator message="Routing your query..." />
      <LoadingIndicator message="Executing tools..." />
    </div>
  );
}
```

---

### 3. RoutingStatsCard (`RoutingStatsCard.tsx`)
A transparent efficiency card that breaks down the router's decision, highlighting selected servers, tool counts (loaded vs. trimmed), estimated context tokens saved, and optional routing reasoning.

#### Props
```typescript
interface RoutingStatsCardProps {
  routing: RoutingSummary | {
    selectedServers: string[];
    toolsLoaded: number;
    toolsTrimmed: number;
    estimatedTokensSaved: number;
    routingTimeMs?: number;
    reasoning?: string;
  };
}
```

#### Usage Example
```tsx
import RoutingStatsCard from '@/app/playground/components/RoutingStatsCard';

export function ExampleRoutingStats() {
  return (
    <RoutingStatsCard
      routing={{
        selectedServers: ['notes'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 120,
        routingTimeMs: 15,
        reasoning: "Query explicitly mentions 'note' and 'meeting'.",
      }}
    />
  );
}
```

---

### 4. ToolResultCard (`ToolResultCard.tsx`)
Displays individual MCP tool execution results or errors. Formats JSON payloads with syntax highlighting borders, handles word wrapping, enables horizontal scrolling for long outputs, and provides an accordion toggle for outputs exceeding 500 characters.

#### Props
```typescript
interface ToolResultCardProps {
  /** The execution result or failure information for a specific MCP tool invocation. */
  result: ToolResult;
}
```

#### Usage Example
```tsx
import ToolResultCard from '@/app/playground/components/ToolResultCard';

export function ExampleToolResults() {
  return (
    <div className="space-y-2">
      {/* Successful invocation */}
      <ToolResultCard
        result={{
          serverID: 'calculator',
          toolName: 'add',
          status: 'success',
          result: { sum: 100 },
        }}
      />

      {/* Failed invocation */}
      <ToolResultCard
        result={{
          serverID: 'notes',
          toolName: 'read_note',
          status: 'error',
          error: 'Note with ID "unknown-id" not found',
        }}
      />
    </div>
  );
}
```

---

## Interactive Containers & Layout Components

### 5. WelcomeMessage (`WelcomeMessage.tsx`)
- **Props**: `onExampleClick: (query: string) => void`
- **Purpose**: Welcomes first-time visitors with an explanation of dynamic routing context efficiency and three clickable one-click queries covering `notes`, `tasks`, and `calculator`.

### 6. InputBar (`InputBar.tsx`)
- **Props**:
  - `onSubmit: (query: string) => Promise<void> | void`
  - `disabled: boolean`
  - `value?: string`
  - `onChange?: (value: string) => void`
  - `inputRef?: RefObject<HTMLInputElement | null>`
- **Purpose**: Captures user input, enforces 1–1000 character length constraints, disables during query processing, and exposes an input ref for immediate post-submission auto-focus.

### 7. TurnDisplay (`TurnDisplay.tsx`)
- **Props**:
  - `turn: Turn`
  - `isExecutingTools?: boolean`
- **Purpose**: Renders the complete timeline card for an individual conversation turn: timestamped user prompt, server warning notices, dynamic routing decision card, tool execution progress indicator, and individual tool result cards.

### 8. ConversationHistory (`ConversationHistory.tsx`)
- **Props**:
  - `turns: Turn[]`
  - `onExampleClick?: (query: string) => void`
  - `isProcessing?: boolean`
  - `loadingMessage?: string`
  - `loadingPhase?: 'routing' | 'executing' | null`
- **Purpose**: Scrollable conversation stream with automatic smooth scrolling upon turn addition or loading phase transitions. Automatically falls back to `<WelcomeMessage />` when turns are empty and no query is processing.

### 9. ChatContainer (`ChatContainer.tsx`)
- **Props**:
  - `initialTurns?: Turn[]`
  - `apiEndpoint?: string`
  - `initialError?: string | null`
- **Purpose**: Pure client-side controller managing the conversation state machine, API fetch requests, phase transitions (`'routing'` -> `'executing'`), and auto-focusing the input bar upon completion.

---

## Responsive Design & Accessibility

- **Mobile Viewports (<640px)**:
  - Form layout transitions from inline flex (`sm:flex-row`) to vertical stacked column (`flex-col`).
  - Metrics in `RoutingStatsCard` stack vertically to avoid truncation or squishing.
  - Font sizes are locked to at least 14px–16px (`text-base sm:text-sm`) to prevent automatic iOS zoom on touch inputs.
- **Code Overflow**:
  - Tool outputs wrap whitespace (`whitespace-pre-wrap break-words`) with `overflow-x-auto` on code wrappers so wide JSON objects scroll independently without page stretching.
- **Live Regions**:
  - In-flight spinners and server warnings leverage ARIA live regions (`role="status"` / `aria-live="polite"`) for screen reader transparency.
