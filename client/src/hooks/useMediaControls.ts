// src/hooks/useMediaControls.ts
import { useState, useEffect } from "react";

const HD_CONFIG: MediaTrackConstraints = {
  width: { min: 1280, ideal: 1280, max: 1920 },
  height: { min: 720, ideal: 720, max: 1080 },
  frameRate: { min: 15, ideal: 20, max: 24 },
};

const SD_CONFIG: MediaTrackConstraints = {
  width: { min: 480, ideal: 640, max: 640 },
  height: { min: 360, ideal: 480, max: 480 },
  frameRate: { min: 10, ideal: 15, max: 20 },
};

export const useMediaControls = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

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
    videoConfig?: MediaTrackConstraints,
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
      return newStream;
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      throw error;
    }
  };

  const stopMedia = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);

        // Actually stop the track to release the microphone
        if (!audioTrack.enabled) {
          audioTrack.stop();
        }
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);

        // Actually stop the track to release the camera
        if (!videoTrack.enabled) {
          videoTrack.stop();
        }
      }
    }
  };

  const restartAudio = async (): Promise<MediaStreamTrack | null> => {
    if (!stream) return null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = stream.getAudioTracks()[0];

      if (oldAudioTrack) {
        stream.removeTrack(oldAudioTrack);
      }

      stream.addTrack(newAudioTrack);
      newAudioTrack.enabled = true;

      return newAudioTrack;
    } catch (error) {
      console.error("Error restarting audio:", error);
      return null;
    }
  };

  const restartVideo = async (): Promise<MediaStreamTrack | null> => {
    if (!stream) return null;

    try {
      const config = hdEnabled ? HD_CONFIG : SD_CONFIG;

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          ...config,
        },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
      }

      stream.addTrack(newVideoTrack);
      newVideoTrack.enabled = true;

      return newVideoTrack;
    } catch (error) {
      console.error("Error restarting video:", error);
      return null;
    }
  };

  const toggleHD = async (): Promise<MediaStreamTrack | null> => {
    if (!stream) return null;

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
      const oldVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(newVideoTrack);

        newVideoTrack.enabled = videoEnabled;

        oldVideoTrack.stop();
      }

      setHdEnabled(newHdState);
      return newVideoTrack;
    } catch (error) {
      console.error("Error toggling HD:", error);
      return null;
    }
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    if (!stream) return null;

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
      const oldVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack) {
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(newVideoTrack);

        newVideoTrack.enabled = videoEnabled;

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
    restartAudio,
    restartVideo,
  };
};
