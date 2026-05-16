// src/hooks/useMediaControls.ts
import { useState, useEffect, useRef } from "react";

interface MediaControlsCallbacks {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onCameraSwitch?: (newTrack: MediaStreamTrack) => void;
}

export const useMediaControls = (
  stream: MediaStream | null,
  callbacks?: MediaControlsCallbacks,
) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
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
    const currentStream = streamRef.current;
    if (currentStream) {
      const audioTrack = currentStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        callbacks?.onAudioToggle?.(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const currentStream = streamRef.current;
    if (currentStream) {
      const videoTrack = currentStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        callbacks?.onVideoToggle?.(videoTrack.enabled);
      }
    }
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    const currentStream = streamRef.current;
    if (!currentStream) return null;

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
      const oldVideoTrack = currentStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        currentStream.removeTrack(oldVideoTrack);
        currentStream.addTrack(newVideoTrack);

        newVideoTrack.enabled = videoEnabled;

        oldVideoTrack.stop();
      }

      setFacingMode(newFacingMode);
      callbacks?.onCameraSwitch?.(newVideoTrack);
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
