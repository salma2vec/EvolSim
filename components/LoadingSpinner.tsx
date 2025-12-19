/**
 * Loading spinner component
 * Refined with better styling and variants
 */

"use client";

interface Props {
  size?: "sm" | "md" | "lg";
  text?: string;
  variant?: "spinner" | "dots" | "pulse";
  className?: string;
}

export default function LoadingSpinner({ 
  size = "md", 
  text, 
  variant = "spinner",
  className = ""
}: Props) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizeClasses = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  if (variant === "dots") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`${sizeClasses[size]} bg-foreground opacity-30 rounded-full animate-pulse`}
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        {text && (
          <p className={`font-mono uppercase tracking-widest opacity-50 ${textSizeClasses[size]}`}>
            {text}
          </p>
        )}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className={`${sizeClasses[size]} bg-foreground/20 rounded-full animate-pulse`} />
        {text && (
          <p className={`font-mono uppercase tracking-widest opacity-50 ${textSizeClasses[size]}`}>
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-2 border-border/30 border-t-foreground rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <p className={`font-mono uppercase tracking-widest opacity-50 ${textSizeClasses[size]}`}>
          {text}
        </p>
      )}
    </div>
  );
}

