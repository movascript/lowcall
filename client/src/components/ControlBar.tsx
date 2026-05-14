import { ControlButton } from "./ControlButton";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Phone,
} from "lucide-react";

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  speakerMode: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  handleLeaveCall: () => void;
}

const ControlBar = ({
  audioEnabled,
  videoEnabled,
  speakerMode,
  toggleAudio,
  toggleVideo,
  toggleSpeaker,
  handleLeaveCall,
}: ControlBarProps) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 flex items-center justify-center gap-3 px-6 py-5 bg-black/90 backdrop-blur-xl border-t border-white/10">
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
        icon={speakerMode ? Volume2 : VolumeX}
        onClick={toggleSpeaker}
        active={speakerMode}
        variant="primary"
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
