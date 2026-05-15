import { useState, useEffect } from "react";

export const useMediaControls = (
  stream: MediaStream | null,
  onAudioToggle?: (enabled: boolean) => void,
  onVideoToggle?: (enabled: boolean) => void,
) => {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  useEffect(() => {
    // Get available cameras
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(
          (device) => device.kind === "videoinput",
        );
        setAvailableCameras(cameras);
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    getCameras();
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

  const switchCamera = async () => {
    if (!stream || availableCameras.length <= 1) return;

    try {
      const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
      const nextCamera = availableCameras[nextIndex];

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: nextCamera.deviceId },
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
        oldVideoTrack.stop();

        // Preserve enabled state
        newVideoTrack.enabled = videoEnabled;
      }

      setCurrentCameraIndex(nextIndex);
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  };

  return {
    audioEnabled,
    videoEnabled,
    availableCameras,
    canSwitchCamera: availableCameras.length > 1,
    toggleAudio,
    toggleVideo,
    switchCamera,
  };
};
