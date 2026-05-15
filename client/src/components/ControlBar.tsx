import { ControlButton } from "./ControlButton";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  SwitchCamera,
} from "lucide-react";

interface ControlBarProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  canSwitchCamera: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
  handleLeaveCall: () => void;
}

const ControlBar = ({
  audioEnabled,
  videoEnabled,
  canSwitchCamera,
  toggleAudio,
  toggleVideo,
  switchCamera,
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
        icon={SwitchCamera}
        onClick={switchCamera}
        active={false}
        variant="primary"
        disabled={!canSwitchCamera}
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
