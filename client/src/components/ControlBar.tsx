import { useEffect, useRef } from "react";
import { ControlButton } from "./ControlButton";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Hd,
  MonitorUp,
  MonitorX,
  Smile,
  MessageCircle,
} from "lucide-react";
import { REACTION_EMOJIS } from "../utils/constants";
import { isMobileDevice } from "../utils/helper";

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  hdEnabled: boolean;
  localScreenSharing: boolean;
  chatOpen: boolean;
  unread: number;
  reactionOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleHD: () => void;
  onToggleScreen: () => void;
  onToggleChat: () => void;
  onToggleReactions: () => void;
  onReact: (emoji: string) => void;
  onLeave: () => void;
}

const ControlBar = ({
  audioEnabled,
  videoEnabled,
  hdEnabled,
  localScreenSharing,
  chatOpen,
  unread,
  reactionOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleHD,
  onToggleScreen,
  onToggleChat,
  onToggleReactions,
  onReact,
  onLeave,
}: ControlBarProps) => {
  const trayRef = useRef<HTMLDivElement>(null);
  const showScreenShare = !isMobileDevice();

  useEffect(() => {
    if (!reactionOpen) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-reaction-toggle]")) return;
      if (trayRef.current?.contains(target)) return;
      onToggleReactions();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [reactionOpen, onToggleReactions]);

  return (
    <div className="relative z-floating flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 bg-black/70 backdrop-blur-xl border-t border-white/10 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-x-auto min-w-0">
      {reactionOpen && (
        <div
          ref={trayRef}
          className="absolute z-tooltip bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex gap-1 px-3 py-2 rounded-full bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Send ${emoji} reaction`}
              onClick={() => onReact(emoji)}
              className="text-xl sm:text-2xl w-10 h-10 rounded-full hover:bg-white/10 hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <ControlButton
        icon={Hd}
        onClick={onToggleHD}
        active={hdEnabled}
        variant="primary"
        label={hdEnabled ? "Switch to standard definition" : "Switch to HD"}
      />
      <ControlButton
        icon={audioEnabled ? Mic : MicOff}
        onClick={onToggleAudio}
        active={audioEnabled}
        label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
      />
      <ControlButton
        icon={videoEnabled ? Video : VideoOff}
        onClick={onToggleVideo}
        active={videoEnabled}
        label={videoEnabled ? "Turn camera off" : "Turn camera on"}
      />
      {showScreenShare && (
        <ControlButton
          icon={localScreenSharing ? MonitorX : MonitorUp}
          onClick={onToggleScreen}
          active={!localScreenSharing}
          variant={localScreenSharing ? "primary" : "default"}
          label={localScreenSharing ? "Stop sharing screen" : "Share screen"}
        />
      )}
      <span data-reaction-toggle>
        <ControlButton
          icon={Smile}
          onClick={onToggleReactions}
          active={!reactionOpen}
          variant={reactionOpen ? "primary" : "default"}
          label="Emoji reactions"
        />
      </span>
      <ControlButton
        icon={MessageCircle}
        onClick={onToggleChat}
        active={!chatOpen}
        variant={chatOpen ? "primary" : "default"}
        label={chatOpen ? "Close chat" : "Open chat"}
        badge={unread}
      />
      <ControlButton
        icon={Phone}
        iconClassname="rotate-135"
        onClick={onLeave}
        variant="danger"
        size="lg"
        label="Leave call"
      />
    </div>
  );
};

export default ControlBar;
