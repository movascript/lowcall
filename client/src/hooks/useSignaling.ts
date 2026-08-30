import { useEffect, useRef, useState } from "react";
import io, { type Socket } from "socket.io-client";

export type ReadyInfo = { polite: boolean };

export interface SignalingHandlers {
  onReady: (info: ReadyInfo) => void;
  onOffer: (offer: RTCSessionDescriptionInit) => void;
  onAnswer: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onUserDisconnected: () => void;
  onRoomFull: () => void;
  onRemoteAudioToggle: (enabled: boolean) => void;
  onRemoteVideoToggle: (enabled: boolean) => void;
  onRemoteScreenShare: (enabled: boolean) => void;
  onRejoined: (info: { peers: number }) => void;
  onErrorMessage: (message: string) => void;
}

export interface SignalingApi {
  connected: boolean;
  setHandlers: (handlers: Partial<SignalingHandlers>) => void;
  joinRoom: (roomId: string, peerId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendOffer: (roomId: string, offer: RTCSessionDescriptionInit) => void;
  sendAnswer: (roomId: string, answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (roomId: string, candidate: RTCIceCandidate) => void;
  notifyAudioToggle: (roomId: string, enabled: boolean) => void;
  notifyVideoToggle: (roomId: string, enabled: boolean) => void;
  notifyScreenShare: (roomId: string, enabled: boolean) => void;
}

export const useSignaling = (signalingServer: string): SignalingApi => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Partial<SignalingHandlers>>({});

  useEffect(() => {
    const socket = io(signalingServer || undefined, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") socket.connect();
    });
    socket.on("reconnect_failed", () => {
      handlersRef.current.onErrorMessage?.(
        "Unable to reconnect to the signaling server. Check your connection.",
      );
    });

    socket.on("ready", (info: ReadyInfo) =>
      handlersRef.current.onReady?.(info ?? { polite: false }),
    );
    socket.on("offer", (o: RTCSessionDescriptionInit) =>
      handlersRef.current.onOffer?.(o),
    );
    socket.on("answer", (a: RTCSessionDescriptionInit) =>
      handlersRef.current.onAnswer?.(a),
    );
    socket.on("ice-candidate", (c: RTCIceCandidateInit) =>
      handlersRef.current.onIceCandidate?.(c),
    );
    socket.on("user-disconnected", () =>
      handlersRef.current.onUserDisconnected?.(),
    );
    socket.on("room-full", () => handlersRef.current.onRoomFull?.());
    socket.on("peer-audio-toggle", (enabled: boolean) =>
      handlersRef.current.onRemoteAudioToggle?.(enabled),
    );
    socket.on("peer-video-toggle", (enabled: boolean) =>
      handlersRef.current.onRemoteVideoToggle?.(enabled),
    );
    socket.on("peer-screen-share", (enabled: boolean) =>
      handlersRef.current.onRemoteScreenShare?.(enabled),
    );
    socket.on("rejoined", (info: { peers: number }) =>
      handlersRef.current.onRejoined?.(info),
    );
    socket.on("error-message", (message: string) =>
      handlersRef.current.onErrorMessage?.(message),
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [signalingServer]);

  return {
    connected,
    setHandlers: (handlers) => {
      handlersRef.current = { ...handlersRef.current, ...handlers };
    },
    joinRoom: (roomId, peerId) =>
      socketRef.current?.emit("join-room", { roomId, peerId }),
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
    notifyScreenShare: (roomId, enabled) =>
      socketRef.current?.emit("screen-share", { roomId, enabled }),
  };
};
