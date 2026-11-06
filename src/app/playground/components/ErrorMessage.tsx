/**
 * @file ErrorMessage.tsx
 * @description Error display component for tool failures and routing errors.
 */

export interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="border border-red-700/50 bg-red-900/10 text-red-300 rounded p-3 text-sm flex items-start gap-2">
      <span className="text-base select-none">⚠️</span>
      <span className="flex-1">{message}</span>
    </div>
  );
}
