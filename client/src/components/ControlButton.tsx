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
  label: string;
  badge?: number;
}

export function ControlButton({
  icon: Icon,
  iconClassname,
  onClick,
  active = true,
  variant = "default",
  size = "md",
  disabled,
  label,
  badge,
}: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "relative rounded-full border-none flex items-center justify-center cursor-pointer transition-all text-white hover:scale-105 active:scale-95",
        size === "md" && "w-12 h-12 sm:w-14 sm:h-14",
        size === "lg" && "w-14 h-14 sm:w-16 sm:h-16",
        variant === "default" &&
          (active
            ? "bg-white/20 hover:bg-white/30"
            : "bg-destructive/90 hover:bg-destructive"),
        variant === "primary" &&
          (active
            ? "bg-blue-500/90 hover:bg-blue-500"
            : "bg-white/20 hover:bg-white/30"),
        variant === "danger" && "bg-destructive/90 hover:bg-destructive",
        disabled && "opacity-50 pointer-events-none",
      )}
      disabled={disabled}
    >
      <Icon size={22} className={iconClassname} />
      {badge ? (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
