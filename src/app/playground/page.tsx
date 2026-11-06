/**
 * @file page.tsx
 * @description Playground Page entry point for natural language querying and dynamic tool routing.
 * Renders page header and wraps the client-side ChatContainer.
 */

import ChatContainer from './components/ChatContainer';

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-purple-900/30 px-8 py-6">
        <h1 className="text-4xl font-bold text-purple-400">
          🎮 Playground
        </h1>
        <p className="text-gray-400 mt-2">
          Ask questions, see routing decisions in real-time
        </p>
      </header>

      <main className="flex-1 h-[calc(100vh-120px)] overflow-hidden flex flex-col">
        <ChatContainer />
      </main>
    </div>
  );
}
