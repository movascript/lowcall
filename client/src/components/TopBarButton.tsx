import { type LucideIcon } from "lucide-react";
import { cn } from "../utils/classname";

interface TopBarButtonProps {
  onClick: () => void;
  Icon: LucideIcon;
  text?: string;
  iconColor?: string;
  textColor?: string;
  title?: string;
}

const TopBarButton = ({
  onClick,
  Icon,
  text,
  iconColor,
  textColor,
  title,
}: TopBarButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 px-2 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10",
        text && "px-4",
      )}
      title={title}
    >
      <span style={{ color: iconColor }}>
        <Icon size={20} />
      </span>
      {text && (
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: textColor }}
        >
          {text}
        </span>
      )}
    </button>
  );
};

export default TopBarButton;
