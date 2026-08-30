import { useCallback, useEffect, useRef, useState } from "react";
import {
  AUDIO_CONSTRAINTS,
  HD_VIDEO,
  SD_VIDEO,
} from "../utils/constants";
import { facingFromTrack, isMobileDevice } from "../utils/helper";
import type { MediaDeviceLists } from "../types";

async function listDevices(): Promise<MediaDeviceLists> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((d) => d.kind === "videoinput"),
    mics: devices.filter((d) => d.kind === "audioinput"),
    speakers: devices.filter((d) => d.kind === "audiooutput"),
  };
}

async function acquireVideoTrack(
  video: MediaTrackConstraints | boolean,
): Promise<MediaStreamTrack | null> {
  try {
    const isolated = await navigator.mediaDevices.getUserMedia({
      video,
      audio: false,
    });
    const track = isolated.getVideoTracks()[0] ?? null;
    isolated.getTracks().forEach((t) => {
      if (t !== track) t.stop();
    });
    if (track) track.contentHint = "motion";
    return track;
  } catch {
    return null;
  }
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
  const switchingRef = useRef(false);

  const refreshDevices = useCallback(async () => {
    try {
      const next = await listDevices();
      setDevices(next);
      setCameraId((id) => id || next.cameras.find((c) => c.deviceId)?.deviceId || "");
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

      const video: MediaTrackConstraints = { ...videoConfig };
      if (cam) video.deviceId = { ideal: cam };
      else video.facingMode = { ideal: facing };

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

  const publishStream = (media: MediaStream) => {
    const next = new MediaStream(media.getTracks());
    streamRef.current = next;
    setStream(next);
  };

  const applyVideoTrack = (
    current: MediaStream,
    track: MediaStreamTrack,
    enabled: boolean,
  ) => {
    track.enabled = enabled;
    current.addTrack(track);
    publishStream(current);
  };

  const initializeMedia = async (): Promise<MediaStream> => {
    setMediaError(null);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(),
      );
      tagVideoHint(newStream);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = newStream;
      setStream(newStream);
      await refreshDevices();
      const videoTrack = newStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      if (settings?.deviceId) setCameraId(settings.deviceId);
      if (videoTrack) setFacingMode(facingFromTrack(videoTrack));
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

  const restoreVideoTrack = async (
    current: MediaStream,
    restore: { deviceId?: string; facingMode?: string; enabled: boolean },
  ) => {
    const restored =
      (restore.deviceId
        ? await acquireVideoTrack({ deviceId: { exact: restore.deviceId } })
        : null) ??
      (restore.facingMode
        ? await acquireVideoTrack({
            facingMode: {
              ideal: restore.facingMode as "user" | "environment",
            },
          })
        : null) ??
      (await acquireVideoTrack(true));
    if (restored) applyVideoTrack(current, restored, restore.enabled);
    else publishStream(current);
  };

  const replaceVideoTrying = async (
    candidates: MediaTrackConstraints[],
    skipDeviceId?: string,
  ): Promise<MediaStreamTrack | null> => {
    const current = streamRef.current;
    if (!current || switchingRef.current) return null;
    switchingRef.current = true;

    const oldTrack = current.getVideoTracks()[0];
    const restore = {
      deviceId: oldTrack?.getSettings().deviceId,
      facingMode: oldTrack?.getSettings().facingMode,
      enabled: oldTrack?.enabled ?? videoEnabled,
    };

    try {
      if (oldTrack) {
        oldTrack.stop();
        current.removeTrack(oldTrack);
        await new Promise((r) => window.setTimeout(r, 80));
      }

      for (const video of candidates) {
        if (streamRef.current !== current) return null;
        const nextTrack = await acquireVideoTrack(video);
        if (streamRef.current !== current) {
          nextTrack?.stop();
          return null;
        }
        if (!nextTrack) continue;
        const newId = nextTrack.getSettings().deviceId;
        if (skipDeviceId && newId === skipDeviceId && candidates.length > 1) {
          nextTrack.stop();
          continue;
        }
        applyVideoTrack(current, nextTrack, restore.enabled);
        return nextTrack;
      }

      if (streamRef.current !== current) return null;
      await restoreVideoTrack(current, restore);
      return null;
    } finally {
      switchingRef.current = false;
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
      publishStream(current);
      return nextTrack;
    } catch {
      return null;
    }
  };

  const commitVideoSelection = (track: MediaStreamTrack, deviceId?: string) => {
    setFacingMode(facingFromTrack(track));
    const id = track.getSettings().deviceId || deviceId;
    if (id) setCameraId(id);
  };

  const toggleHD = async (): Promise<MediaStreamTrack | null> => {
    const nextHd = !hdEnabled;
    const resolution = nextHd ? HD_VIDEO : SD_VIDEO;
    const track = await replaceVideoTrying([
      {
        ...resolution,
        ...(cameraId ? { deviceId: { ideal: cameraId } } : { facingMode: { ideal: facingMode } }),
      },
      cameraId
        ? { deviceId: { ideal: cameraId } }
        : { facingMode: { ideal: facingMode } },
    ]);
    if (track) {
      setHdEnabled(nextHd);
      commitVideoSelection(track);
    }
    return track;
  };

  const switchCamera = async (): Promise<MediaStreamTrack | null> => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    const resolution = hdEnabled ? HD_VIDEO : SD_VIDEO;
    const others = devices.cameras.filter(
      (c) => c.deviceId && c.deviceId !== cameraId,
    );

    const candidates: MediaTrackConstraints[] = [
      { ...resolution, facingMode: { exact: nextFacing } },
      { facingMode: { exact: nextFacing } },
      { facingMode: { ideal: nextFacing } },
      ...others.map((c) => ({ deviceId: { exact: c.deviceId } })),
    ];

    const track = await replaceVideoTrying(candidates, cameraId);
    if (track) commitVideoSelection(track);
    return track;
  };

  const selectCamera = async (
    deviceId: string,
  ): Promise<MediaStreamTrack | null> => {
    if (deviceId === cameraId) {
      return streamRef.current?.getVideoTracks()[0] ?? null;
    }

    const all = devices.cameras.filter((c) => c.deviceId);
    const start = all.findIndex((c) => c.deviceId === deviceId);
    const ordered =
      start >= 0 ? [...all.slice(start), ...all.slice(0, start)] : all;

    const candidates: MediaTrackConstraints[] = ordered.flatMap((cam) => [
      { deviceId: { exact: cam.deviceId } },
    ]);

    const track = await replaceVideoTrying(candidates, cameraId);
    if (track) commitVideoSelection(track, deviceId);
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

  const canSwitchCamera =
    isMobileDevice() || devices.cameras.filter((c) => c.deviceId).length > 1;

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
