// hooks/useMediaControls.ts
import { useState } from "react";

export const useMediaControls = (stream: MediaStream | null) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [speakerMode, setSpeakerMode] = useState(false);

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setSpeakerMode(!speakerMode);
  };

  return {
    audioEnabled,
    videoEnabled,
    speakerMode,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
  };
};
