/**
 * @file WelcomeMessage.tsx
 * @description Empty state component displaying onboarding guidance and clickable example queries.
 */

export interface WelcomeMessageProps {
  onExampleClick: (query: string) => void;
}

export const EXAMPLE_QUERIES = [
  { text: 'Add a note about the meeting', server: 'notes' },
  { text: 'Show my tasks', server: 'tasks' },
  { text: 'What is 42 + 58?', server: 'calculator' },
];

export default function WelcomeMessage({ onExampleClick }: WelcomeMessageProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="text-6xl mb-4">🎮</div>
        <h2 className="text-3xl font-bold text-purple-400">
          Welcome to FrankenMCP Playground
        </h2>
        <p className="text-gray-400 text-lg">
          Ask questions and watch the router select relevant tools in real-time,
          trimming unnecessary context to save tokens.
        </p>

        <div className="mt-8">
          <h3 className="text-sm font-bold text-gray-500 mb-3">TRY THESE EXAMPLES:</h3>
          <div className="space-y-2">
            {EXAMPLE_QUERIES.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onExampleClick(example.text)}
                className="w-full text-left px-4 py-3 bg-gray-800 border border-gray-700 rounded hover:border-purple-500 hover:bg-gray-750 transition cursor-pointer"
              >
                <div className="text-gray-100">{example.text}</div>
                <div className="text-xs text-gray-500 mt-1">
                  → Routes to <span className="text-purple-400 font-mono">{example.server}</span> server
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
