# Monster Lab Dashboard Components

The Monster Lab Dashboard (`/lab`) provides real-time transparency and context efficiency metrics for FrankenMCP's dynamic routing engine.

---

## Architecture & Hierarchy

The dashboard is structured as a Next.js Server Component page that fetches initial data on the server, passes it to client panels, and continuously synchronizes with background routing changes via 5-second polling intervals.

```
src/app/lab/page.tsx (Server Component)
├── Header ("🧪 Monster Lab Dashboard")
└── Main
    ├── <ErrorFallback /> (Rendered if initial getSessionStats() fails)
    └── Success View:
        ├── <StatsPanel /> (Client Component)
        │   ├── <MetricCard label="Tools Loaded" ... />
        │   ├── <MetricCard label="Tools Trimmed" ... />
        │   ├── <MetricCard label="Tokens Saved" ... />
        │   └── <MetricCard label="Avg Routing Time" ... />
        │
        ├── <TurnHistoryPanel /> (Client Component)
        │   └── <TurnCard /> (Per-turn collapsible card)
        │       ├── Summary row (timestamp, intent preview, loaded/trimmed/tokens/latency)
        │       └── Expanded view (full intent, tools by server with loaded/trimmed tags, reasoning)
        │
        └── <ServerHealthPanel /> (Client Component)
            └── Per-server status rows
                └── <ServerStatusBadge /> (Pill badge: connected, error, disconnected, starting)
```

---

## Polling Strategy & Data Sources

The dashboard avoids heavy WebSockets by employing lightweight, decoupled HTTP polling:

| Component | Polling Interval | Endpoint | Data Source | Failure Handling |
| :--- | :--- | :--- | :--- | :--- |
| `StatsPanel` | 5,000 ms (5s) | `/api/lab/session-stats` | `getSessionStats()` | Retains stale data, displays warning banner |
| `TurnHistoryPanel` | 5,000 ms (5s) | `/api/lab/session-stats` | `getSessionStats().turns` | Retains existing turns on failure |
| `ServerHealthPanel`| 5,000 ms (5s) | `/api/lab/server-status` | `MCPServerManager.getServerManifests()` | Retains stale manifests, displays warning banner |

Both polling intervals use `setInterval` with clean `clearInterval` teardown inside `useEffect`. In case of network errors, stale statistics remain visible without flashing or crashing the interface.

---

## Reusable Components & Usage Examples

### 1. MetricCard (`MetricCard.tsx`)
A dashboard card displaying a large single numerical or text metric with units, descriptions, and color-coded themes.

#### Props
```typescript
interface MetricCardProps {
  label: string;             // Short uppercase header (e.g. "Tools Loaded")
  value: number | string;    // Formatted metric value (e.g. 42 or "~1,450")
  unit?: string;             // Optional unit suffix (e.g. "tools", "tokens", "ms")
  description?: string;      // Optional explanatory subtext
  color?: 'green' | 'purple' | 'cyan' | 'yellow'; // Accent color theme (default: 'green')
  prefix?: string;           // Optional prefix (e.g. "~")
}
```

#### Usage Example
```tsx
import MetricCard from '@/app/lab/components/MetricCard';

export function ExampleMetrics() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard
        label="Tools Trimmed"
        value={18}
        unit="tools"
        description="Excluded by dynamic routing filter"
        color="purple"
      />
      <MetricCard
        label="Tokens Saved"
        value={2450}
        unit="tokens"
        prefix="~"
        description="Context window overhead avoided"
        color="cyan"
      />
    </div>
  );
}
```

---

### 2. ServerStatusBadge (`ServerStatusBadge.tsx`)
A color-coded pill badge representing MCP server connectivity and health state.

#### Props
```typescript
interface ServerStatusBadgeProps {
  status: 'connected' | 'error' | 'disconnected' | 'starting';
}
```

#### Usage Example
```tsx
import ServerStatusBadge from '@/app/lab/components/ServerStatusBadge';

export function ServerRow({ name, status }: { name: string; status: any }) {
  return (
    <div className="flex items-center gap-3">
      <ServerStatusBadge status={status} />
      <span className="font-mono text-sm">{name}</span>
    </div>
  );
}
```

---

### 3. ErrorFallback (`ErrorFallback.tsx`)
A resilient error banner for displaying graceful failure messages when dashboard statistics or services are unavailable.

#### Props
```typescript
interface ErrorFallbackProps {
  error?: Error; // Optional captured Error instance
}
```

#### Usage Example
```tsx
import ErrorFallback from '@/app/lab/components/ErrorFallback';

export function SafeDashboard({ hasError, error }: { hasError: boolean; error?: Error }) {
  if (hasError) {
    return <ErrorFallback error={error} />;
  }
  return <div>Dashboard content...</div>;
}
```

---

## Panel Components Reference

### 4. StatsPanel (`StatsPanel.tsx`)
- **Props**:
  - `initialStats: SessionStatistics` — Server-rendered aggregate statistics.
  - `initialError?: string | null` — Optional initial error message.
- **Renders**: Responsive 4-column metric grid (`Tools Loaded`, `Tools Trimmed`, `Tokens Saved`, `Avg Routing Time`).

### 5. TurnHistoryPanel (`TurnHistoryPanel.tsx`)
- **Props**:
  - `initialTurns: TurnStatistics[]` — Server-rendered turn statistics.
  - `allServerTools?: Map<string, string[]>` — Server-to-tool names mapping used to calculate trimmed tools.
- **Renders**: Reverse-chronological feed showing the last 20 routing turns, or an empty state prompt if no turns have been executed.

### 6. TurnCard (`TurnCard.tsx`)
- **Props**:
  - `turn: TurnStatistics` — The individual routing turn data.
  - `allServerTools?: Map<string, string[]>` — Tool mapping to deduce trimmed tools.
  - `initialExpanded?: boolean` — Default collapse/expand state (default: `false`).
- **Renders**: Clickable accordion card displaying intent preview, selected servers, loaded/trimmed counts, and expanded reasoning breakdown.

### 7. ServerHealthPanel (`ServerHealthPanel.tsx`)
- **Props**:
  - `initialManifests: ServerManifest[]` — Server-rendered MCP server manifests.
  - `initialError?: string | null` — Optional initial error message.
- **Renders**: List of registered MCP servers, live status badges, tool counts, and offline timers/errors. Shows a prominent warning if all servers are offline.
