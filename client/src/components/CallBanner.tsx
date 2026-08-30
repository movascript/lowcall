import type { ReactNode } from "react";
import { cn } from "../utils/classname";

export function CallBanner({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "danger" | "ok";
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-floating px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-md",
        tone === "neutral" && "bg-black/70 text-white",
        tone === "warn" && "bg-amber-500/90 text-black",
        tone === "danger" && "bg-red-500/90 text-white",
        tone === "ok" && "bg-emerald-500/90 text-white",
      )}
    >
      {children}
    </div>
  );
}

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-tooltip max-w-md w-[90%] bg-red-600/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-start justify-between gap-3">
      <p className="text-sm">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 text-white/80 hover:text-white text-sm font-semibold"
      >
        OK
      </button>
    </div>
  );
}
