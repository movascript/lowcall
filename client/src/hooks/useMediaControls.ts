import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIO_CONSTRAINTS,
  HD_VIDEO,
  SD_VIDEO,
} from "../utils/constants";
import type { MediaDeviceLists } from "../types";

async function listDevices(): Promise<MediaDeviceLists> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((d) => d.kind === "videoinput"),
    mics: devices.filter((d) => d.kind === "audioinput"),
    speakers: devices.filter((d) => d.kind === "audiooutput"),
  };
}

export const useMediaControls = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [devices, setDevices] = useState<MediaDeviceLists>({
    cameras: [],
    mics: [],
    speakers: [],
  });
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const next = await listDevices();
      setDevices(next);
      setCameraId((id) => id || next.cameras[0]?.deviceId || "");
      setMicId((id) => id || next.mics[0]?.deviceId || "");
      setSpeakerId((id) => id || next.speakers[0]?.deviceId || "");
    } catch {
      // Permissions may still be pending.
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener("devicechange", onChange);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- enumerate cameras/mics on mount
    void refreshDevices();
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", onChange);
    };
  }, [refreshDevices]);

  const buildConstraints = useCallback(
    (opts?: {
      hd?: boolean;
      camera?: string;
      mic?: string;
      facing?: "user" | "environment";
    }): MediaStreamConstraints => {
      const hd = opts?.hd ?? hdEnabled;
      const cam = opts?.camera ?? cameraId;
      const mic = opts?.mic ?? micId;
      const facing = opts?.facing ?? facingMode;
      const videoConfig = hd ? HD_VIDEO : SD_VIDEO;

      const video: MediaTrackConstraints = {
        ...videoConfig,
        facingMode: { ideal: facing },
      };
      if (cam) video.deviceId = { ideal: cam };

      const audio: MediaTrackConstraints = { ...AUDIO_CONSTRAINTS };
      if (mic) audio.deviceId = { ideal: mic };

      return { video, audio };
    },
    [hdEnabled, cameraId, micId, facingMode],
  );

  const tagVideoHint = (media: MediaStream) => {
    const video = media.getVideoTracks()[0];
    if (video) video.contentHint = "motion";
  };

  const initializeMedia = async (): Promise<MediaStream> => {
    setMediaError(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(),
      );
      tagVideoHint(newStream);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setStream(newStream);
      streamRef.current = newStream;
      await refreshDevices();
      const settings = newStream.getVideoTracks()[0]?.getSettings();
      if (settings?.deviceId) setCameraId(settings.deviceId);
      const audioSettings = newStream.getAudioTracks()[0]?.getSettings();
      if (audioSettings?.deviceId) setMicId(audioSettings.deviceId);
      return newStream;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not access camera or microphone";
      setMediaError(message);
      throw error;
    }
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  };

  const toggleAudio = (): boolean => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return audioEnabled;
    const next = !track.enabled;
    track.enabled = next;
    setAudioEnabled(next);
    return next;
  };

  const toggleVideo = (): boolean => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return videoEnabled;
    const next = !track.enabled;
    track.enabled = next;
    setVideoEnabled(next);
    return next;
  };

  const replaceVideoInStream = async (
    constraints: MediaStreamConstraints,
  ): Promise<MediaStreamTrack | null> => {
    const current = streamRef.current;
    if (!current) return null;
    const oldTrack = current.getVideoTracks()[0];
    try {
      const isolated = await navigator.mediaDevices.getUserMedia({
        video: constraints.video || true,
        audio: false,
      });
      const nextTrack = isolated.getVideoTracks()[0];
      nextTrack.contentHint = "motion";
      nextTrack.enabled = videoEnabled;
      if (oldTrack) {
        oldTrack.stop();
        current.removeTrack(oldTrack);
      }
      current.addTrack(nextTrack);
      setStream(current);
      return nextTrack;
    } catch {
      return null;
    }
  };

  const replaceAudioInStream = async (
    deviceId: string,
  ): Promise<MediaStreamTrack | null> => {
    const current = streamRef.current;
    if (!current) return null;
    const oldTrack = current.getAudioTracks()[0];
    try {
      const isolated = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO_CONSTRAINTS, deviceId: { ideal: deviceId } },
        video: false,
      });
      const nextTrack = isolated.getAudioTracks()[0];
      nextTrack.enabled = audioEnabled;
      if (oldTrack) {
        oldTrack.stop();
        current.removeTrack(oldTrack);
      }
      current.addTrack(nextTrack);
      setStream(current);
      return nextTrack;
    } catch {
      return null;
    }
  };

  const toggleHD = async (): Promise<MediaStreamTrack | null> => {
    const nextHd = !hdEnabled;
    const track = await replaceVideoInStream({
      video: {
        ...(nextHd ? HD_VIDEO : SD_VIDEO),
        facingMode: { ideal: facingMode },
        ...(cameraId ? { deviceId: { ideal: cameraId } } : {}),
      },
    });
    if (track) setHdEnabled(nextHd);
    return track;
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    const track = await replaceVideoInStream({
      video: {
        ...(hdEnabled ? HD_VIDEO : SD_VIDEO),
        facingMode: { ideal: nextFacing },
      },
    });
    if (track) {
      setFacingMode(nextFacing);
      const id = track.getSettings().deviceId;
      if (id) setCameraId(id);
    }
    return track;
  };

  const selectCamera = async (
    deviceId: string,
  ): Promise<MediaStreamTrack | null> => {
    const track = await replaceVideoInStream({
      video: {
        ...(hdEnabled ? HD_VIDEO : SD_VIDEO),
        deviceId: { exact: deviceId },
      },
    });
    if (track) setCameraId(deviceId);
    return track;
  };

  const selectMic = async (
    deviceId: string,
  ): Promise<MediaStreamTrack | null> => {
    const track = await replaceAudioInStream(deviceId);
    if (track) setMicId(deviceId);
    return track;
  };

  const selectSpeaker = (deviceId: string) => {
    setSpeakerId(deviceId);
  };

  const canSwitchCamera = devices.cameras.length > 1;

  return {
    stream,
    audioEnabled,
    videoEnabled,
    hdEnabled,
    facingMode,
    canSwitchCamera,
    devices,
    cameraId,
    micId,
    speakerId,
    mediaError,
    initializeMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
    selectCamera,
    selectMic,
    selectSpeaker,
    refreshDevices,
  };
};
