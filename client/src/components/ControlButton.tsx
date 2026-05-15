// src/components/ControlButton.tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "../utils/classname";

interface ControlButtonProps {
  icon: LucideIcon;
  iconClassname?: string;
  onClick: () => void;
  active?: boolean;
  variant?: "default" | "danger" | "primary";
  size?: "md" | "lg";
  disabled?: boolean;
}

export function ControlButton({
  icon: Icon,
  iconClassname,
  onClick,
  active = true,
  variant = "default",
  size = "md",
  disabled,
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border-none flex items-center justify-center cursor-pointer transition-all text-white hover:scale-105 active:scale-95",
        size === "md" && "w-14 h-14",
        size === "lg" && "w-16 h-16",
        variant === "default" &&
          (active
            ? "bg-white/20 hover:bg-white/30"
            : "bg-destructive/90 hover:bg-destructive"),
        variant === "primary" &&
          (active
            ? "bg-blue-500/90 hover:bg-blue-500"
            : "bg-white/20 hover:bg-white/30"),
        variant === "danger" && "bg-destructive/90 hover:bg-destructive",
      )}
      disabled={disabled}
    >
      <Icon size={24} className={iconClassname} />
    </button>
  );
}
