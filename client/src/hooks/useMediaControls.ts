// src/hooks/useMediaControls.ts
import { useState, useEffect } from "react";

export const useMediaControls = (
  stream: MediaStream | null,
  onAudioToggle?: (enabled: boolean) => void,
  onVideoToggle?: (enabled: boolean) => void,
) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  useEffect(() => {
    // Check if device has multiple cameras
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(
          (device) => device.kind === "videoinput",
        );
        setCanSwitchCamera(cameras.length > 1);
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    checkCameras();
  }, []);

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        onAudioToggle?.(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        onVideoToggle?.(videoTrack.enabled);
      }
    }
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    if (!stream) return null;

    try {
      const newFacingMode = facingMode === "user" ? "environment" : "user";

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: newFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24 },
        },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack) {
        // Replace track in the stream
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(newVideoTrack);

        // Preserve enabled state
        newVideoTrack.enabled = videoEnabled;

        // Stop old track
        oldVideoTrack.stop();
      }

      setFacingMode(newFacingMode);
      return newVideoTrack;
    } catch (error) {
      console.error("Error switching camera:", error);
      return null;
    }
  };

  return {
    audioEnabled,
    videoEnabled,
    canSwitchCamera,
    facingMode,
    toggleAudio,
    toggleVideo,
    switchCamera,
  };
};
