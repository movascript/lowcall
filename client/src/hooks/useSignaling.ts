// src/hooks/useSignaling.ts
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

export interface SignalingEvent {
  // Inbound — things the peer/server tells us
  onReady: (() => void) | null;
  onOffer: ((offer: RTCSessionDescriptionInit) => void) | null;
  onAnswer: ((answer: RTCSessionDescriptionInit) => void) | null;
  onIceCandidate: ((candidate: RTCIceCandidateInit) => void) | null;
  onIceRestart: (() => void) | null;
  onUserDisconnected: (() => void) | null;
  onRoomFull: (() => void) | null;
  onRemoteAudioToggle: ((enabled: boolean) => void) | null;
  onRemoteVideoToggle: ((enabled: boolean) => void) | null;
  // Outbound — things we send to the peer/server
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendOffer: (roomId: string, offer: RTCSessionDescriptionInit) => void;
  sendAnswer: (roomId: string, answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (roomId: string, candidate: RTCIceCandidate) => void;
  notifyAudioToggle: (roomId: string, enabled: boolean) => void;
  notifyVideoToggle: (roomId: string, enabled: boolean) => void;
  // Connection state
  connected: boolean;
}

export const useSignaling = (signalingServer: string): SignalingEvent => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Mutable slots for inbound event handlers — set by useWebRTC after mount
  const onReady = useRef<SignalingEvent["onReady"]>(null);
  const onOffer = useRef<SignalingEvent["onOffer"]>(null);
  const onAnswer = useRef<SignalingEvent["onAnswer"]>(null);
  const onIceCandidate = useRef<SignalingEvent["onIceCandidate"]>(null);
  const onIceRestart = useRef<SignalingEvent["onIceRestart"]>(null);
  const onUserDisconnected = useRef<SignalingEvent["onUserDisconnected"]>(null);
  const onRoomFull = useRef<SignalingEvent["onRoomFull"]>(null);
  const onRemoteAudioToggle =
    useRef<SignalingEvent["onRemoteAudioToggle"]>(null);
  const onRemoteVideoToggle =
    useRef<SignalingEvent["onRemoteVideoToggle"]>(null);

  useEffect(() => {
    const socket = io(signalingServer, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setConnected(false);
      if (reason === "io server disconnect") socket.connect();
    });

    socket.on("reconnect", (attempt: number) =>
      console.log("Socket reconnected after", attempt, "attempts"),
    );
    socket.on("reconnect_attempt", (attempt: number) =>
      console.log("Reconnection attempt:", attempt),
    );
    socket.on("reconnect_error", (error: Error) =>
      console.error("Reconnection error:", error),
    );
    socket.on("reconnect_failed", () => {
      console.error("Reconnection failed");
      alert("Unable to reconnect to server. Please refresh the page.");
    });

    socket.on("ready", () => onReady.current?.());
    socket.on("offer", (o) => onOffer.current?.(o));
    socket.on("answer", (a) => onAnswer.current?.(a));
    socket.on("ice-candidate", (c) => onIceCandidate.current?.(c));
    socket.on("ice-restart", () => onIceRestart.current?.());
    socket.on("user-disconnected", () => onUserDisconnected.current?.());
    socket.on("room-full", () => onRoomFull.current?.());
    socket.on("peer-audio-toggle", (enabled) =>
      onRemoteAudioToggle.current?.(enabled),
    );
    socket.on("peer-video-toggle", (enabled) =>
      onRemoteVideoToggle.current?.(enabled),
    );

    return () => {
      socket.disconnect();
    };
  }, [signalingServer]);

  return {
    // Connection state
    connected,
    // Inbound — writable slots; useWebRTC assigns these
    get onReady() {
      return onReady.current;
    },
    set onReady(fn) {
      onReady.current = fn;
    },
    get onOffer() {
      return onOffer.current;
    },
    set onOffer(fn) {
      onOffer.current = fn;
    },
    get onAnswer() {
      return onAnswer.current;
    },
    set onAnswer(fn) {
      onAnswer.current = fn;
    },
    get onIceCandidate() {
      return onIceCandidate.current;
    },
    set onIceCandidate(fn) {
      onIceCandidate.current = fn;
    },
    get onIceRestart() {
      return onIceRestart.current;
    },
    set onIceRestart(fn) {
      onIceRestart.current = fn;
    },
    get onUserDisconnected() {
      return onUserDisconnected.current;
    },
    set onUserDisconnected(fn) {
      onUserDisconnected.current = fn;
    },
    get onRoomFull() {
      return onRoomFull.current;
    },
    set onRoomFull(fn) {
      onRoomFull.current = fn;
    },
    get onRemoteAudioToggle() {
      return onRemoteAudioToggle.current;
    },
    set onRemoteAudioToggle(fn) {
      onRemoteAudioToggle.current = fn;
    },
    get onRemoteVideoToggle() {
      return onRemoteVideoToggle.current;
    },
    set onRemoteVideoToggle(fn) {
      onRemoteVideoToggle.current = fn;
    },
    // Outbound — emit helpers
    joinRoom: (roomId) => socketRef.current?.emit("join-room", roomId),
    leaveRoom: (roomId) => socketRef.current?.emit("leave-room", roomId),
    sendOffer: (roomId, offer) =>
      socketRef.current?.emit("offer", { roomId, offer }),
    sendAnswer: (roomId, answer) =>
      socketRef.current?.emit("answer", { roomId, answer }),
    sendIceCandidate: (roomId, candidate) =>
      socketRef.current?.emit("ice-candidate", { roomId, candidate }),
    notifyAudioToggle: (roomId, enabled) =>
      socketRef.current?.emit("audio-toggle", { roomId, enabled }),
    notifyVideoToggle: (roomId, enabled) =>
      socketRef.current?.emit("video-toggle", { roomId, enabled }),
  };
};
