# Technical Stack & Standards — FrankenMCP

## Technology Stack

### Core Framework
- **TypeScript** (strict mode, ES2022 target)
- **Next.js 16.4.5** (App Router, React Server Components)
- **React 19.3.0**
- **Tailwind CSS 4** for styling

### MCP Integration
- **@modelcontextprotocol/sdk** (^1.32.2) for client and server implementations
- **mcp-dynamic-router** (external dependency via `npx -y github:leethoneid/mcp-dynamic-router serve`)
  - Router is a pre-existing open-source component by the author
  - Do NOT modify router code; wrap it with adapter layers in this repository

### Testing
- **Vitest** (^3.2.7) for unit and integration tests
- **fast-check** (^4.10.2) for property-based testing (PBT)
- Three PBT invariants, each with ≥100 test cases:
  1. Trimming never removes required parameters from preserved tools
  2. Same input intent + same server set → same routing decision (determinism)
  3. Tool schema survives trimming round-trip (fidelity)

### Deployment
- **Vercel** (free tier)
- Automatic deployment from `main` branch
- Zero environment variables required for demo servers

### Package Management
- **npm** (lock file committed)
- Node.js ≥20 required

## Command Reference

```bash
# Development
npm install          # Install all dependencies
npm run dev          # Start Next.js dev server (localhost:3000)

# Testing
npm test             # Run all tests (Vitest, includes PBT)
npm run lint         # Run ESLint

# Production
npm run build        # Build for production
npm start            # Start production server

# Router dependency (invoked automatically by adapter layer)
npx -y github:leethoneid/mcp-dynamic-router serve
```

## Code Standards

### TypeScript
- Use strict mode (`tsconfig.json` with `strict: true`)
- Explicit return types for public APIs
- Prefer `interface` over `type` for object shapes
- No `any`; use `unknown` for truly dynamic data

### File Organization
- React Server Components by default
- Client Components marked with `"use client"`
- Co-locate types with implementations
- One component per file for UI modules

### Error Handling
- Always handle promise rejections
- Fail loud: explicit error messages, no silent fallbacks to mock data
- Use type-safe error boundaries for UI

### Testing
- Test behavior, not implementation helpers
- Real subprocess spawning for MCP server tests
- Mark synthetic/demo data with `[DEMO]` prefix in output
- Document which `requirements.md` entry each PBT case validates

## Security Standards

- **Fail-closed defaults**: No default API keys; unauthorized requests return 401
- **Secrets**: All sensitive values via environment variables (`.env*` in `.gitignore`)
- **CORS**: Restrict to own domain; no `Access-Control-Allow-Origin: *`
- **Token transmission**: Only via `Authorization: Bearer` or `X-API-Key` header; never in query params

## Deployment Standards

- `main` branch must always be deployable
- CI must pass before merge (tests green, build succeeds)
- Vercel deployment must succeed on every push
- Demo servers pre-configured in `.kiro/settings/mcp.json`
