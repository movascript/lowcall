import { useEffect, useRef, useState, type RefObject } from "react";
import type { SignalingApi } from "./useSignaling";
import { useConnectionStats } from "./useConnectionStats";
import { getPeerId, log } from "../utils/helper";
import {
  applySenderParams,
  bitrateForTrack,
  preferCodecs,
} from "../utils/ice";
import { BITRATE } from "../utils/constants";
import type { IceUiState } from "../types";

function isLiveIce(state: RTCIceConnectionState | undefined) {
  return (
    state === "connected" ||
    state === "completed" ||
    state === "checking" ||
    state === "disconnected"
  );
}

export const useWebRTC = (
  signaling: SignalingApi,
  iceServers: RTCConfiguration,
  hdEnabled: boolean,
) => {
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] =
    useState<MediaStream | null>(null);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [localScreenSharing, setLocalScreenSharing] = useState(false);
  const [iceState, setIceState] = useState<IceUiState>("new");
  const [peerLeft, setPeerLeft] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [polite, setPolite] = useState(false);
  const [roleReady, setRoleReady] = useState(false);
  const [pcEpoch, setPcEpoch] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentRoomRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const reconnectTimeout = useRef<number | null>(null);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const politeRef = useRef(false);
  const canNegotiate = useRef(false);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cameraTrackIdRef = useRef<string | null>(null);
  const hdEnabledRef = useRef(hdEnabled);
  const signalingRef = useRef(signaling);
  const iceServersRef = useRef(iceServers);

  hdEnabledRef.current = hdEnabled;
  signalingRef.current = signaling;
  iceServersRef.current = iceServers;

  const { stats, resetStats } = useConnectionStats(
    peerConnectionRef,
    connected,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    peerConnectionRef.current?.setConfiguration(iceServers);
  }, [iceServers]);

  function clearReconnectTimeout() {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }

  function resetRemoteMedia() {
    setConnected(false);
    setRemoteStream(null);
    setRemoteScreenStream(null);
    resetStats();
    setRemoteAudioEnabled(true);
    setRemoteVideoEnabled(true);
    setRemoteScreenSharing(false);
    cameraTrackIdRef.current = null;
  }

  function flushPendingCandidates() {
    const pc = peerConnectionRef.current;
    if (!pc?.remoteDescription) return;
    const queued = pendingCandidates.current;
    pendingCandidates.current = [];
    queued.forEach(async (c) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // Candidate may be outdated after restart.
      }
    });
  }

  async function applyBitrates(pc: RTCPeerConnection) {
    for (const sender of pc.getSenders()) {
      const track = sender.track;
      if (!track) continue;
      const max =
        sender === screenSenderRef.current
          ? BITRATE.screen
          : bitrateForTrack(track, hdEnabledRef.current);
      const degradation =
        sender === screenSenderRef.current
          ? "maintain-resolution"
          : "maintain-framerate";
      await applySenderParams(sender, max, degradation);
    }
  }

  function addLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
    for (const track of stream.getTracks()) {
      const sender = pc.addTrack(track, stream);
      if (track.kind === "audio") audioSenderRef.current = sender;
      if (track.kind === "video") videoSenderRef.current = sender;
    }
    preferCodecs(pc);
    void applyBitrates(pc);
  }

  async function negotiate() {
    const pc = peerConnectionRef.current;
    const room = currentRoomRef.current;
    if (!pc || !canNegotiate.current || !room) return;
    if (makingOffer.current || pc.signalingState !== "stable") return;
    try {
      makingOffer.current = true;
      const offer = await pc.createOffer();
      if (pc.signalingState !== "stable") return;
      await pc.setLocalDescription(offer);
      if (pc.localDescription) {
        signalingRef.current.sendOffer(room, pc.localDescription);
      }
    } catch (error) {
      log("Negotiate error", error);
    } finally {
      makingOffer.current = false;
    }
  }

  async function handleReady(info: { polite: boolean }) {
    politeRef.current = info.polite;
    setPolite(info.polite);
    setRoleReady(true);
    canNegotiate.current = true;
    setPeerLeft(false);
  }

  async function handleOffer(offer: RTCSessionDescriptionInit) {
    const pc = peerConnectionRef.current ?? createPeerConnection();
    const offerCollision =
      makingOffer.current || pc.signalingState !== "stable";
    ignoreOffer.current = !politeRef.current && offerCollision;
    if (ignoreOffer.current) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (pc.localDescription) {
        signalingRef.current.sendAnswer(
          currentRoomRef.current,
          pc.localDescription,
        );
      }
      await applyBitrates(pc);
    } catch (error) {
      log("Answer error", error);
    }
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      flushPendingCandidates();
      await applyBitrates(pc);
    } catch (error) {
      log("Set remote answer error", error);
    }
  }

  async function handleIceCandidate(candidate: RTCIceCandidateInit) {
    const pc = peerConnectionRef.current;
    try {
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        pendingCandidates.current.push(candidate);
      }
    } catch (e) {
      log("ICE candidate error", e);
    }
  }

  function handleUserDisconnected() {
    if (!mountedRef.current) return;
    setPeerLeft(true);
    resetRemoteMedia();
    canNegotiate.current = false;
    setRoleReady(false);
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    if (currentRoomRef.current && localStreamRef.current) {
      createPeerConnection();
    }
  }

  function handleRoomFull() {
    setRoomError("This room is full. Maximum 2 people.");
    cleanupAll();
  }

  async function triggerIceRestart() {
    const pc = peerConnectionRef.current;
    if (!pc || politeRef.current || !canNegotiate.current) return;
    if (pc.signalingState !== "stable") return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      if (pc.localDescription) {
        signalingRef.current.sendOffer(
          currentRoomRef.current,
          pc.localDescription,
        );
      }
    } catch (error) {
      log("ICE restart failed", error);
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout.current || politeRef.current) return;
    reconnectTimeout.current = window.setTimeout(() => {
      void triggerIceRestart();
      reconnectTimeout.current = null;
    }, 3000);
  }

  function createPeerConnection(): RTCPeerConnection {
    peerConnectionRef.current?.close();
    pendingCandidates.current = [];
    audioSenderRef.current = null;
    videoSenderRef.current = null;
    makingOffer.current = false;
    ignoreOffer.current = false;

    const pc = new RTCPeerConnection(iceServersRef.current);
    peerConnectionRef.current = pc;
    if (mountedRef.current) setPcEpoch((n) => n + 1);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && currentRoomRef.current) {
        signalingRef.current.sendIceCandidate(
          currentRoomRef.current,
          candidate,
        );
      }
    };

    pc.onnegotiationneeded = () => {
      void negotiate();
    };

    pc.ontrack = (event) => {
      const track = event.track;
      if (track.kind === "audio") {
        setRemoteStream((prev) => {
          const next = new MediaStream(prev ? prev.getTracks() : []);
          next.getAudioTracks().forEach((t) => next.removeTrack(t));
          next.addTrack(track);
          return next;
        });
      }
      if (track.kind === "video") {
        const isScreen =
          Boolean(cameraTrackIdRef.current) &&
          cameraTrackIdRef.current !== track.id;
        if (!cameraTrackIdRef.current) cameraTrackIdRef.current = track.id;

        if (isScreen) {
          setRemoteScreenStream(new MediaStream([track]));
          setRemoteScreenSharing(true);
          track.onended = () => {
            setRemoteScreenStream(null);
            setRemoteScreenSharing(false);
          };
        } else {
          cameraTrackIdRef.current = track.id;
          setRemoteStream((prev) => {
            const next = new MediaStream(prev ? prev.getTracks() : []);
            next.getVideoTracks().forEach((t) => next.removeTrack(t));
            next.addTrack(track);
            return next;
          });
        }
      }
      if (mountedRef.current) {
        setConnected(true);
        setPeerLeft(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      log("ICE state:", state);
      if (mountedRef.current) setIceState(state as IceUiState);
      if (state === "disconnected") scheduleReconnect();
      if (state === "failed") {
        clearReconnectTimeout();
        void triggerIceRestart();
      }
      if (state === "connected" || state === "completed") {
        clearReconnectTimeout();
      }
    };

    pc.onconnectionstatechange = () => {
      log("Connection state:", pc.connectionState);
      if (
        pc.connectionState === "failed" &&
        mountedRef.current &&
        !politeRef.current
      ) {
        void triggerIceRestart();
      }
      if (pc.connectionState === "closed" && mountedRef.current) {
        resetRemoteMedia();
      }
    };

    if (localStreamRef.current) {
      addLocalTracks(pc, localStreamRef.current);
    }

    if (screenTrackRef.current && screenTrackRef.current.readyState === "live") {
      const screenStream = new MediaStream([screenTrackRef.current]);
      screenSenderRef.current = pc.addTrack(
        screenTrackRef.current,
        screenStream,
      );
      void applySenderParams(
        screenSenderRef.current,
        BITRATE.screen,
        "maintain-resolution",
      );
    }

    return pc;
  }

  useEffect(() => {
    signaling.setHandlers({
      onReady: handleReady,
      onOffer: handleOffer,
      onAnswer: handleAnswer,
      onIceCandidate: handleIceCandidate,
      onUserDisconnected: handleUserDisconnected,
      onRoomFull: handleRoomFull,
      onRemoteAudioToggle: (enabled) => setRemoteAudioEnabled(enabled),
      onRemoteVideoToggle: (enabled) => setRemoteVideoEnabled(enabled),
      onRemoteScreenShare: (enabled) => {
        setRemoteScreenSharing(enabled);
        if (!enabled) setRemoteScreenStream(null);
      },
      onRejoined: () => {
        setPeerLeft(false);
      },
      onErrorMessage: (message) => setRoomError(message),
    });
  });

  useEffect(() => {
    if (!signaling.connected) return;
    if (!currentRoomRef.current || !localStreamRef.current) return;

    const pc = peerConnectionRef.current;
    const ice = pc?.iceConnectionState;
    if (pc && isLiveIce(ice)) {
      signaling.joinRoom(currentRoomRef.current, getPeerId());
      return;
    }
    createPeerConnection();
    signaling.joinRoom(currentRoomRef.current, getPeerId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaling.connected]);

  function cleanupAll() {
    clearReconnectTimeout();
    stopScreenShareInternal();
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    canNegotiate.current = false;
    if (mountedRef.current) {
      resetRemoteMedia();
      setPeerLeft(false);
      setLocalScreenSharing(false);
      setRoleReady(false);
      setIceState("closed");
    }
  }

  function stopScreenShareInternal() {
    const pc = peerConnectionRef.current;
    if (screenSenderRef.current && pc) {
      try {
        pc.removeTrack(screenSenderRef.current);
      } catch {
        // Sender may already be gone.
      }
    }
    screenSenderRef.current = null;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
  }

  const syncLocalStream = (stream: MediaStream | null) => {
    localStreamRef.current = stream;
  };

  const joinRoom = (roomId: string, stream: MediaStream) => {
    localStreamRef.current = stream;
    currentRoomRef.current = roomId;
    setRoomError(null);
    setPeerLeft(false);
    createPeerConnection();
    signaling.joinRoom(roomId, getPeerId());
  };

  const leaveRoom = () => {
    if (currentRoomRef.current) signaling.leaveRoom(currentRoomRef.current);
    cleanupAll();
    currentRoomRef.current = "";
  };

  const replaceVideoTrack = async (track: MediaStreamTrack | null) => {
    const sender = videoSenderRef.current;
    try {
      if (sender) {
        await sender.replaceTrack(track);
        if (track) {
          await applySenderParams(
            sender,
            bitrateForTrack(track, hdEnabledRef.current),
          );
        }
      }
    } catch (e) {
      log("Error replacing video track", e);
    }
  };

  const replaceAudioTrack = async (track: MediaStreamTrack | null) => {
    const sender = audioSenderRef.current;
    try {
      if (sender) await sender.replaceTrack(track);
    } catch (e) {
      log("Error replacing audio track", e);
    }
  };

  const startScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) throw new Error("Not in a call");
    const display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15 } },
      audio: false,
    });
    const track = display.getVideoTracks()[0];
    if (!track) throw new Error("No screen track");
    track.contentHint = "detail";
    track.onended = () => {
      void stopScreenShare();
    };
    stopScreenShareInternal();
    screenTrackRef.current = track;
    screenSenderRef.current = pc.addTrack(track, display);
    await applySenderParams(
      screenSenderRef.current,
      BITRATE.screen,
      "maintain-resolution",
    );
    setLocalScreenSharing(true);
    signaling.notifyScreenShare(currentRoomRef.current, true);
  };

  const stopScreenShare = async () => {
    stopScreenShareInternal();
    setLocalScreenSharing(false);
    if (currentRoomRef.current) {
      signaling.notifyScreenShare(currentRoomRef.current, false);
    }
  };

  const notifyPeerAudioToggle = (enabled: boolean) =>
    signaling.notifyAudioToggle(currentRoomRef.current, enabled);

  const notifyPeerVideoToggle = (enabled: boolean) =>
    signaling.notifyVideoToggle(currentRoomRef.current, enabled);

  const clearRoomError = () => setRoomError(null);

  return {
    connected,
    stats,
    remoteStream,
    remoteScreenStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    remoteScreenSharing,
    localScreenSharing,
    iceState,
    peerLeft,
    roomError,
    polite,
    roleReady,
    pcEpoch,
    peerConnectionRef: peerConnectionRef as RefObject<RTCPeerConnection | null>,
    joinRoom,
    leaveRoom,
    syncLocalStream,
    replaceVideoTrack,
    replaceAudioTrack,
    startScreenShare,
    stopScreenShare,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
    clearRoomError,
    kickNegotiate: () => {
      if (!politeRef.current) void negotiate();
    },
  };
};
