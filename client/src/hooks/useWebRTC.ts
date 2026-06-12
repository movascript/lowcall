// src/hooks/useWebRTC.ts
import { useEffect, useRef, useState } from "react";
import type { SignalingEvent } from "./useSignaling";
import { useConnectionStats } from "./useConnectionStats";

export const useWebRTC = (
  signaling: SignalingEvent,
  iceServers: RTCConfiguration,
) => {
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentRoomRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const reconnectTimeout = useRef<number | null>(null);
  const isReconnecting = useRef(false);

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

  // Wire all inbound signaling events directly onto the signaling object
  useEffect(() => {
    signaling.onReady = handleReady;
    signaling.onOffer = handleOffer;
    signaling.onAnswer = handleAnswer;
    signaling.onIceCandidate = handleIceCandidate;
    signaling.onIceRestart = triggerIceRestart;
    signaling.onUserDisconnected = handleUserDisconnected;
    signaling.onRoomFull = handleRoomFull;
    signaling.onRemoteAudioToggle = (enabled) => setRemoteAudioEnabled(enabled);
    signaling.onRemoteVideoToggle = (enabled) => setRemoteVideoEnabled(enabled);
  });

  // Re-join room when signaling reconnects while we're in a room
  useEffect(() => {
    if (!signaling.connected) {
      if (mountedRef.current) setConnected(false);
      return;
    }
    if (currentRoomRef.current && localStreamRef.current) {
      console.log(
        "Rejoining room after signaling reconnect:",
        currentRoomRef.current,
      );
      createPeerConnection();
      signaling.joinRoom(currentRoomRef.current);
    }
  }, [signaling.connected]);

  // ─── Signaling event handlers ─────────────────────────────────────────────

  async function handleReady() {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signaling.sendOffer(currentRoomRef.current, offer);
    } catch (error) {
      console.error("Offer error:", error);
    }
  }

  async function handleOffer(offer: RTCSessionDescriptionInit) {
    try {
      const pc = peerConnectionRef.current ?? createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signaling.sendAnswer(currentRoomRef.current, answer);
    } catch (error) {
      console.error("Answer error:", error);
    }
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    const pc = peerConnectionRef.current;
    if (pc && pc.signalingState !== "stable") {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      flushPendingCandidates();
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
      console.error("ICE candidate error:", e);
    }
  }

  function handleUserDisconnected() {
    if (mountedRef.current) {
      setConnected(false);
      setRemoteStream(null);
      resetStats();
      setRemoteAudioEnabled(true);
      setRemoteVideoEnabled(true);
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    if (currentRoomRef.current && localStreamRef.current)
      createPeerConnection();
  }

  function handleRoomFull() {
    alert("Room is full. Maximum 2 users allowed.");
    cleanupAll();
    window.location.reload();
  }

  // ─── Peer connection helpers ──────────────────────────────────────────────

  function flushPendingCandidates() {
    const pc = peerConnectionRef.current;
    if (!pc?.remoteDescription) return;
    pendingCandidates.current.forEach(async (c) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error("Queued ICE error:", e);
      }
    });
    pendingCandidates.current = [];
  }

  async function triggerIceRestart() {
    const pc = peerConnectionRef.current;
    if (!pc || isReconnecting.current) return;
    isReconnecting.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      signaling.sendOffer(currentRoomRef.current, offer);
      console.log("ICE restart offer sent");
    } catch (error) {
      console.error("ICE restart failed:", error);
    } finally {
      isReconnecting.current = false;
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout.current) return;
    reconnectTimeout.current = setTimeout(() => {
      triggerIceRestart();
      reconnectTimeout.current = null;
    }, 3000) as unknown as number;
  }

  function clearReconnectTimeout() {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }

  function createPeerConnection(): RTCPeerConnection {
    peerConnectionRef.current?.close();
    pendingCandidates.current = [];

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate)
        signaling.sendIceCandidate(currentRoomRef.current, candidate);
    };

    pc.ontrack = (event) => {
      setRemoteStream((prev) => {
        const next = new MediaStream(prev ? prev.getTracks() : []);
        if (!next.getTracks().find((t) => t.id === event.track.id))
          next.addTrack(event.track);
        return next;
      });
      if (mountedRef.current) setConnected(true);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "disconnected") scheduleReconnect();
      if (pc.iceConnectionState === "failed") {
        clearReconnectTimeout();
        triggerIceRestart();
      }
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        clearReconnectTimeout();
        isReconnecting.current = false;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (
        ["disconnected", "failed"].includes(pc.connectionState) &&
        mountedRef.current
      ) {
        setConnected(false);
      }
      if (pc.connectionState === "closed" && mountedRef.current) {
        setConnected(false);
        setRemoteStream(null);
        resetStats();
        setRemoteAudioEnabled(true);
        setRemoteVideoEnabled(true);
      }
    };

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => pc.addTrack(track, localStreamRef.current!));

    return pc;
  }

  function cleanupAll() {
    clearReconnectTimeout();
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    if (mountedRef.current) {
      setConnected(false);
      setRemoteStream(null);
      resetStats();
      setRemoteAudioEnabled(true);
      setRemoteVideoEnabled(true);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  const joinRoom = (roomId: string, stream: MediaStream) => {
    localStreamRef.current = stream;
    currentRoomRef.current = roomId;
    createPeerConnection();
    signaling.joinRoom(roomId);
  };

  const leaveRoom = () => {
    if (currentRoomRef.current) signaling.leaveRoom(currentRoomRef.current);
    cleanupAll();
    currentRoomRef.current = "";
  };

  const replaceVideoTrack = async (track: MediaStreamTrack) => {
    const sender = peerConnectionRef.current
      ?.getSenders()
      .find((s) => s.track?.kind === "video");
    try {
      if (sender) await sender.replaceTrack(track);
    } catch (e) {
      console.error("Error replacing video track:", e);
    }
  };

  const replaceAudioTrack = async (track: MediaStreamTrack) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
    try {
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, localStreamRef.current!);
    } catch (e) {
      console.error("Error replacing audio track:", e);
    }
  };

  const notifyPeerAudioToggle = (enabled: boolean) =>
    signaling.notifyAudioToggle(currentRoomRef.current, enabled);

  const notifyPeerVideoToggle = (enabled: boolean) =>
    signaling.notifyVideoToggle(currentRoomRef.current, enabled);

  return {
    connected,
    stats,
    remoteStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    joinRoom,
    leaveRoom,
    replaceVideoTrack,
    replaceAudioTrack,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
  };
};
