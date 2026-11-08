# Directory Structure & Conventions — FrankenMCP

## Repository Layout

```
frankenmcp/
├── .kiro/                      # Kiro workflow artifacts (NEVER gitignore)
│   ├── specs/                  # Feature specifications (requirements → design → tasks)
│   │   ├── router-core/
│   │   ├── monster-lab-dashboard/
│   │   ├── playground-chat/
│   │   └── deployment/
│   ├── steering/               # Project-wide guidelines (this directory)
│   │   ├── product.md          # Product vision, users, value prop
│   │   ├── tech.md             # Tech stack, commands, standards
│   │   └── structure.md        # Directory structure (this file)
│   ├── hooks/                  # Agent hooks (event-driven automation)
│   │   ├── typecheck-on-save.json
│   │   └── schema-snapshot-on-mcp-change.json
│   ├── settings/
│   │   └── mcp.json            # Pre-configured demo MCP servers
│   └── agents/                 # Custom agent definitions
│       └── router-orchestrator.json
├── docs/                       # Project documentation
│   └── build-plan.md           # Hackathon implementation plan
├── public/                     # Static assets
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page
│   │   ├── playground/         # Chat interface route
│   │   └── lab/                # Monster Lab dashboard route
│   ├── lib/                    # Shared libraries and business logic
│   │   ├── router/             # Router adapter layer (wraps mcp-dynamic-router)
│   │   │   ├── adapter.ts      # Adapter interface to external router
│   │   │   ├── stats.ts        # Routing statistics tracking
│   │   │   └── types.ts        # Router-related TypeScript types
│   │   ├── mcp/                # MCP client/server utilities
│   │   │   ├── client.ts       # MCP client wrapper
│   │   │   └── server-manager.ts  # Multi-server lifecycle management
│   │   └── utils/              # General utilities
│   ├── mcp-servers/            # Built-in demo MCP servers
│   │   ├── notes/              # Notes CRUD server (stdio)
│   │   │   ├── index.ts
│   │   │   └── package.json    # Independent MCP server package
│   │   ├── tasks/              # Tasks CRUD server (stdio)
│   │   │   ├── index.ts
│   │   │   └── package.json
│   │   └── calculator/         # Arithmetic server (stdio)
│   │       ├── index.ts
│   │       └── package.json
│   └── demo/                   # Demo/mock data generators
│       ├── fixtures.ts         # Fixture data for demo servers
│       └── synthetic.ts        # Synthetic stats (MUST be labeled [DEMO])
├── tests/                      # Test suites
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests (spawn real servers)
│   └── pbt/                    # Property-based tests (fast-check)
│       ├── trimming.test.ts    # PBT: trimming preserves required params
│       ├── determinism.test.ts # PBT: routing is deterministic
│       └── fidelity.test.ts    # PBT: schema round-trip fidelity
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── LICENSE                     # MIT License (required for hackathon)
├── README.md                   # English documentation (primary)
└── README.zh-CN.md             # Chinese documentation (synchronized)
```

## Module Boundaries

### 1. Router Layer (`src/lib/router/`)
- **Purpose**: Adapter for the external `mcp-dynamic-router` dependency
- **Responsibilities**:
  - Invoke router via subprocess (`npx -y github:leethoneid/mcp-dynamic-router serve`)
  - Parse routing decisions and schema trimming results
  - Track per-turn statistics (tools loaded, tools trimmed, token savings)
- **Constraints**:
  - Do NOT modify router source code (it's a dependency, not part of this repo)
  - All customization goes in the adapter layer

### 2. MCP Layer (`src/lib/mcp/`)
- **Purpose**: Manage MCP server lifecycle and communication
- **Responsibilities**:
  - Connect to MCP servers via stdio, SSE, or Streamable HTTP
  - Dispatch tool calls to appropriate servers
  - Monitor server health and connection status
- **Constraints**:
  - Must support all three MCP transport types
  - Fail loud on connection errors (no silent mock fallbacks)

### 3. Demo Servers (`src/mcp-servers/`)
- **Purpose**: Self-contained MCP servers for zero-config demos (built-in demo MCP servers: notes, tasks, calculator)
- **Responsibilities**:
  - Implement standard MCP protocol (stdio transport)
  - Provide realistic tool schemas
  - Use in-memory or JSON file storage (no external dependencies)
- **Constraints**:
  - Each server is an independent package with its own `package.json`
  - No API keys or external services required
  - Data is ephemeral or fixture-based

### 4. Demo/Mock Data (`src/demo/`)
- **Purpose**: Synthetic data for demonstrations and testing
- **Responsibilities**:
  - Generate fixture notes, tasks, and conversations
  - Provide baseline stats for dashboard comparisons
- **Constraints**:
  - **MUST NOT** be imported by production code paths
  - All output must be labeled `[DEMO]` or equivalent
  - Physical isolation: production modules cannot import from `src/demo/`

### 5. Tests (`tests/`)
- **Purpose**: Verify correctness, especially PBT invariants
- **Responsibilities**:
  - Unit tests for adapters and utilities
  - Integration tests spawning real MCP servers
  - PBT for router invariants (≥100 cases each)
- **Constraints**:
  - Each PBT test must annotate which `requirements.md` entry it validates
  - No skipped tests without explicit `[SKIPPED: reason]` logging

## Naming Conventions

- **Files**: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- **Components**: `PascalCase` for component names, co-locate types
- **Functions**: `camelCase` for functions and variables
- **Types**: `PascalCase` for interfaces and types, `SCREAMING_SNAKE_CASE` for constants
- **MCP Servers**: Lowercase directory names matching server ID (e.g., `notes`, `tasks`)

## Import Order

1. External dependencies (e.g., `react`, `next`)
2. Internal absolute imports (e.g., `@/lib/router`)
3. Relative imports (e.g., `./types`, `../utils`)
4. Type-only imports last (`import type { ... }`)

## Git Workflow

- `main` branch is always deployable
- Feature branches: `feat/<feature-name>`
- Bug fixes: `fix/<issue-description>`
- Docs: `docs/<topic>`
- Commit messages: Conventional Commits format (`feat:`, `fix:`, `docs:`, `test:`)
