/**
 * Error message display component
 */

"use client";

interface Props {
  error: string | Error;
  onDismiss?: () => void;
}

export default function ErrorMessage({ error, onDismiss }: Props) {
  const message = error instanceof Error ? error.message : error;

  return (
    <div className="border border-red-500 bg-red-500/10 p-4 rounded">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-red-500 font-bold mb-1">Error</h3>
          <p className="text-sm text-gray-300">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-500 hover:text-red-400 text-xl leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

