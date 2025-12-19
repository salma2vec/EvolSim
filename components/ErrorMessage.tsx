/**
 * Error message display component
 * Refined to match design system
 */

"use client";

interface Props {
  error: string | Error;
  onDismiss?: () => void;
  variant?: "inline" | "card";
}

export default function ErrorMessage({ error, onDismiss, variant = "card" }: Props) {
  const message = error instanceof Error ? error.message : error;

  if (variant === "inline") {
    return (
      <div className="border-l-2 border-[var(--signal-collapse)] pl-4 py-2">
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--signal-collapse)]">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className="card border-[var(--signal-collapse)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-serif text-sm uppercase tracking-wider text-[var(--signal-collapse)] mb-2">
            Error
          </h3>
          <p className="font-mono text-xs opacity-80 leading-relaxed">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none font-mono"
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

