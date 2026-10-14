/**
 * Skeleton loader component for content placeholders
 */

"use client";

interface Props {
  lines?: number;
  className?: string;
  variant?: "text" | "card" | "bar";
}

export default function SkeletonLoader({ lines = 3, className = "", variant = "text" }: Props) {
  if (variant === "card") {
    return (
      <div className={`card animate-pulse ${className}`}>
        <div className="h-4 bg-foreground/10 rounded-sm mb-3 w-3/4" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-foreground/10 rounded-sm"
              style={{ width: i === lines - 1 ? "60%" : "100%" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className={`h-2 bg-foreground/10 rounded-sm animate-pulse ${className}`} />
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-foreground/10 rounded-sm animate-pulse"
          style={{ width: i === lines - 1 ? "75%" : "100%" }}
        />
      ))}
    </div>
  );
}

