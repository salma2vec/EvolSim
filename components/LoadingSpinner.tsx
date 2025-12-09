/**
 * Loading spinner component
 */

"use client";

interface Props {
  size?: "sm" | "md" | "lg";
  text?: string;
}

export default function LoadingSpinner({ size = "md", text }: Props) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`${sizeClasses[size]} border-2 border-border border-t-accent rounded-full animate-spin`}
      />
      {text && (
        <p className="text-xs font-mono uppercase tracking-widest opacity-50">
          {text}
        </p>
      )}
    </div>
  );
}

