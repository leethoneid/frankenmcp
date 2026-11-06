/**
 * @file LoadingIndicator.tsx
 * @description Loading spinner component for asynchronous routing and tool operations.
 */

export interface LoadingIndicatorProps {
  message?: string;
}

export default function LoadingIndicator({ message = 'Routing...' }: LoadingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-purple-950/20 border border-purple-800/40 rounded-lg text-purple-300 text-sm">
      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      <span>{message}</span>
    </div>
  );
}
