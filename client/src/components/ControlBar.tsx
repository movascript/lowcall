// src/components/ControlBar.tsx
import { ControlButton } from "./ControlButton";
import { Mic, MicOff, Video, VideoOff, Phone, Hd } from "lucide-react";

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  hdEnabled: boolean;

  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleHD: () => void;

  handleLeaveCall: () => void;
}

const ControlBar = ({
  audioEnabled,
  videoEnabled,
  hdEnabled,
  toggleAudio,
  toggleVideo,
  toggleHD,
  handleLeaveCall,
}: ControlBarProps) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 flex items-center justify-center gap-3 px-6 py-5 bg-black/90 backdrop-blur-xl border-t border-white/10">
      <ControlButton
        icon={Hd}
        onClick={toggleHD}
        active={hdEnabled}
        variant="primary"
      />
      <ControlButton
        icon={audioEnabled ? Mic : MicOff}
        onClick={toggleAudio}
        active={audioEnabled}
      />
      <ControlButton
        icon={videoEnabled ? Video : VideoOff}
        onClick={toggleVideo}
        active={videoEnabled}
      />
      <ControlButton
        icon={Phone}
        iconClassname="rotate-135"
        onClick={handleLeaveCall}
        variant="danger"
        size="lg"
      />
    </div>
  );
};

export default ControlBar;
