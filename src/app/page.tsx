import type { Metadata } from 'next';
import Link from 'next/link';
import LiveHealthBadge from './components/LiveHealthBadge';

export const metadata: Metadata = {
  title: 'FrankenMCP — Stitched MCP Architecture & Dynamic Tool Routing',
  description:
    'Suturing incompatible Model Context Protocol (MCP) servers into a unified, high-efficiency AI application via intelligent dynamic tool routing.',
};

const DEMO_SERVERS = [
  {
    id: 'notes',
    name: 'Notes Server',
    icon: '📝',
    description: 'In-memory notebook store for managing persistent markdown notes and memos.',
    tools: [
      { name: 'create_note', desc: 'Create a new note with a title and content' },
      { name: 'read_note', desc: 'Read a note by its unique identifier' },
      { name: 'update_note', desc: 'Update title or content of an existing note' },
      { name: 'delete_note', desc: 'Delete a note by its identifier' },
      { name: 'list_notes', desc: 'List all notes available in the local store' },
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks Server',
    icon: '✅',
    description: 'Task checklist manager supporting priority tagging and completion tracking.',
    tools: [
      { name: 'create_task', desc: 'Create a new task with title and optional priority' },
      { name: 'read_task', desc: 'Get task details by task ID' },
      { name: 'update_task', desc: 'Update task properties or completion status' },
      { name: 'delete_task', desc: 'Delete a task by ID' },
      { name: 'list_tasks', desc: 'List all tasks, optionally filtering by completion' },
    ],
  },
  {
    id: 'calculator',
    name: 'Calculator Server',
    icon: '🧮',
    description: 'Stateless mathematical computation engine and multi-category unit converter.',
    tools: [
      { name: 'add', desc: 'Add two numbers (a + b)' },
      { name: 'subtract', desc: 'Subtract b from a (a - b)' },
      { name: 'multiply', desc: 'Multiply two numbers (a * b)' },
      { name: 'divide', desc: 'Divide a by b (a / b)' },
      { name: 'convert_units', desc: 'Convert length (m/ft/in), weight (kg/lb), or temperature (C/F)' },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Navigation Header */}
      <header className="border-b border-gray-800/80 bg-gray-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label="FrankenMCP logo">
              🧪
            </span>
            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-teal-400">
              FrankenMCP
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
              Kiroween 2026
            </span>
          </div>

          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/playground"
              className="text-gray-300 hover:text-emerald-400 transition-colors"
            >
              Playground
            </Link>
            <Link
              href="/lab"
              className="text-gray-300 hover:text-emerald-400 transition-colors"
            >
              Monster Lab
            </Link>
            <a
              href="https://github.com/leethoneid/frankenmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900/60 text-gray-300 hover:text-white hover:border-gray-700 transition-colors flex items-center gap-1.5"
            >
              <span>GitHub</span>
              <span className="text-xs text-gray-500">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-6 border-b border-gray-800/60 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-gray-950 to-gray-950">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/20 border border-emerald-500/30 text-emerald-300">
              <span>🎃</span>
              <span>Kiroween 2026 Hackathon • Frankenstein Category</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Suturing Incompatible MCP Servers into a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400">
                Unified AI Agent
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg text-gray-300 leading-relaxed">
              FrankenMCP stitches disparate, incompatible Model Context Protocol (MCP) servers into a single cohesive application.
              Using intelligent dynamic routing, it prunes bloated tool catalogs and selects only the tools required for each query.
            </p>

            <div className="pt-2 flex justify-center">
              <LiveHealthBadge />
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/playground"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/50 hover:shadow-purple-900/60 transition-all flex items-center justify-center gap-2"
              >
                <span>🎮</span>
                <span>Try the Playground</span>
              </Link>
              <Link
                href="/lab"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold bg-gray-900 hover:bg-gray-800 text-emerald-400 border border-emerald-800/50 hover:border-emerald-600 shadow-lg shadow-black/40 transition-all flex items-center justify-center gap-2"
              >
                <span>🧪</span>
                <span>Open Monster Lab</span>
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works (Three-Step Pipeline) */}
        <section className="py-20 px-6 border-b border-gray-800/60 bg-gray-950">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                Dynamic Routing Pipeline
              </span>
              <h2 className="text-3xl font-bold text-white">How It Works</h2>
              <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
                Eliminating context bloat by ensuring models only receive the exact tools needed for each turn.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 flex flex-col justify-between space-y-4 hover:border-gray-700 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">💬</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                      Step 01
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Natural Language Query</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Users submit natural language intent in the chat interface—requesting arithmetic calculations, persistent notes, or task checklist operations.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-xs font-mono text-gray-500">
                  Input → Chat Interface
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-emerald-900/40 bg-gray-900/60 p-6 flex flex-col justify-between space-y-4 hover:border-emerald-800/60 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">⚡</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                      Step 02
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Dynamic Router Pruning</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    The router indexes tool schemas using TF-IDF and BM25 token matching, matching the prompt against tool capabilities to select only the relevant tools.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-xs font-mono text-emerald-400/80">
                  TF-IDF + BM25 Matching
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 flex flex-col justify-between space-y-4 hover:border-gray-700 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🎯</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                      Step 03
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">Dispatched Execution</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Extracted arguments are dispatched to the designated MCP server, executing the tool and returning structured outputs directly into the conversational turn.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-800/80 text-xs font-mono text-gray-500">
                  Tool Execution → Result Stream
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Demo Servers Showcase */}
        <section className="py-20 px-6 border-b border-gray-800/60 bg-gray-900/30">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                Connected Services
              </span>
              <h2 className="text-3xl font-bold text-white">Three Pre-Configured Demo Servers</h2>
              <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
                15 distinct tools operational on startup across Notes, Tasks, and Calculator without any external dependencies.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {DEMO_SERVERS.map((server) => (
                <div
                  key={server.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/80 p-6 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{server.icon}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                        5 tools
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-white">{server.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">{server.description}</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-800">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                        Tool Manifest
                      </span>
                      <ul className="space-y-2">
                        {server.tools.map((tool) => (
                          <li key={tool.name} className="text-xs">
                            <span className="font-mono text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-900/40">
                              {tool.name}
                            </span>
                            <p className="text-gray-400 text-[11px] mt-0.5">{tool.desc}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800 text-[11px] font-mono text-gray-500 flex items-center justify-between">
                    <span>Transport</span>
                    <span className="text-gray-300">in-process / stdio</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dual-Mode Architecture Callout */}
        <section className="py-16 px-6 bg-gray-950">
          <div className="max-w-4xl mx-auto rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-gray-900/80 to-gray-950 p-8 sm:p-10 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <h2 className="text-2xl font-bold text-white">
                Dual-Mode Architecture: Local &amp; Serverless Ready
              </h2>
            </div>

            <p className="text-gray-300 text-base leading-relaxed">
              FrankenMCP runs identically in both local development and Vercel cloud environments without code changes:
              locally via <span className="text-emerald-400 font-mono">stdio child processes</span>, and in the cloud via{' '}
              <span className="text-emerald-400 font-mono">zero-latency in-process adapters</span> (no subprocess restrictions or cold start timeouts).
            </p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-gray-800 bg-gray-950/60 space-y-2">
                <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                  Local Environment
                </span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Spawns isolated Node.js child processes over stdio transports. Fully transparent process isolation for multi-process MCP server testing.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-800 bg-gray-950/60 space-y-2">
                <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
                  Vercel Serverless
                </span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Swaps child processes for memory-safe in-process adapters with 100% schema parity. Initialized in milliseconds with zero subprocess errors.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 bg-gray-950 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="text-base">🧪</span>
            <span className="font-semibold text-gray-200">FrankenMCP</span>
            <span>—</span>
            <span>Kiroween 2026 Hackathon (Frankenstein Category)</span>
          </div>

          <div className="flex items-center gap-6">
            <span>Built with Kiro + Next.js + Vercel</span>
            <span>•</span>
            <a
              href="https://github.com/leethoneid/frankenmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-2"
            >
              GitHub Repository
            </a>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
