'use client';

/**
 * @file InputBar.tsx
 * @description User query input component with submit button, input validation, and responsive mobile layout.
 * Enforces non-empty input and a maximum 1000-character constraint.
 */

import { useState, FormEvent, RefObject } from 'react';

/**
 * Props for the InputBar component.
 */
export interface InputBarProps {
  /** Callback invoked with trimmed user query text on successful submission. */
  onSubmit: (query: string) => Promise<void> | void;
  /** Whether the input and submit button should be disabled (e.g. during query processing). */
  disabled: boolean;
  /** Optional controlled input value. */
  value?: string;
  /** Optional change handler for controlled input usage. */
  onChange?: (value: string) => void;
  /** Optional ref forwarded to the underlying HTML input element for programmatic focus. */
  inputRef?: RefObject<HTMLInputElement | null>;
}

/**
 * Renders the query input bar with validation, submit handling, and auto-focus support.
 */
export default function InputBar({
  onSubmit,
  disabled,
  value,
  onChange,
  inputRef,
}: InputBarProps) {
  const [internalQuery, setInternalQuery] = useState('');
  const query = value !== undefined ? value : internalQuery;
  const setQuery = onChange || setInternalQuery;
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      setValidationError('Please enter a query');
      return;
    }

    if (trimmed.length > 1000) {
      setValidationError('Query too long (max 1000 characters)');
      return;
    }

    setValidationError(null);
    await onSubmit(trimmed);
    setQuery('');
  }

  return (
    <div className="border-t border-purple-900/30 p-4 bg-gray-900">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (validationError) setValidationError(null);
          }}
          placeholder="Ask a question..."
          disabled={disabled}
          className="w-full sm:flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 text-base sm:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || query.trim().length === 0}
          className="w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-base sm:text-sm"
        >
          {disabled ? 'Processing...' : 'Submit'}
        </button>
      </form>
      {validationError && (
        <div className="mt-2 text-sm text-red-400">{validationError}</div>
      )}
    </div>
  );
}
