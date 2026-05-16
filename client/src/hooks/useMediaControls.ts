// src/hooks/useMediaControls.ts
import { useState, useEffect, useRef } from "react";

interface MediaControlsCallbacks {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onCameraSwitch?: (newTrack: MediaStreamTrack) => void;
}

interface VideoQualityConfig {
  width: { ideal: number };
  height: { ideal: number };
  frameRate: { ideal: number };
}

const HD_CONFIG: VideoQualityConfig = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24 },
};

const SD_CONFIG: VideoQualityConfig = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 20 },
};

export const useMediaControls = (callbacks?: MediaControlsCallbacks) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [hdEnabled, setHdEnabled] = useState(false);
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

  const getMediaStream = async (
    videoConfig?: VideoQualityConfig,
  ): Promise<MediaStream> => {
    const config = videoConfig || (hdEnabled ? HD_CONFIG : SD_CONFIG);

    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        ...config,
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  };

  const initializeMedia = async (): Promise<MediaStream> => {
    try {
      const newStream = await getMediaStream();
      setStream(newStream);
      streamRef.current = newStream;
      return newStream;
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      throw error;
    }
  };

  const stopMedia = () => {
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      setStream(null);
      streamRef.current = null;
    }
  };

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

  const toggleHD = async (): Promise<MediaStreamTrack | null> => {
    const currentStream = streamRef.current;
    if (!currentStream) return null;

    try {
      const newHdState = !hdEnabled;
      const config = newHdState ? HD_CONFIG : SD_CONFIG;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          ...config,
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

      setHdEnabled(newHdState);
      callbacks?.onCameraSwitch?.(newVideoTrack);
      return newVideoTrack;
    } catch (error) {
      console.error("Error toggling HD:", error);
      return null;
    }
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    const currentStream = streamRef.current;
    if (!currentStream) return null;

    try {
      const newFacingMode = facingMode === "user" ? "environment" : "user";
      const config = hdEnabled ? HD_CONFIG : SD_CONFIG;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: newFacingMode },
          ...config,
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
    stream,
    audioEnabled,
    videoEnabled,
    hdEnabled,
    canSwitchCamera,
    facingMode,
    initializeMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
  };
};
