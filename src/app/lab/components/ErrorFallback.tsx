interface ErrorFallbackProps {
  error?: Error;
}

export default function ErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="border border-red-500 rounded-lg p-8 bg-red-900/10 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold text-red-400 mb-2">
        Stats Unavailable
      </h2>
      <p className="text-gray-400 mb-4">
        Unable to load routing statistics. Please check server logs.
      </p>
      {process.env.NODE_ENV === 'development' && error && (
        <details className="text-left text-xs text-gray-500 mt-4">
          <summary className="cursor-pointer">Error details (dev only)</summary>
          <pre className="mt-2 p-2 bg-gray-900 rounded overflow-x-auto">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}

export type { ErrorFallbackProps };
