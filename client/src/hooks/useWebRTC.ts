// src/hooks/useWebRTC.ts
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import { useConnectionStats } from "./useConnectionStats";

interface WebRTCCallbacks {
  onRemoteAudioToggle?: (enabled: boolean) => void;
  onRemoteVideoToggle?: (enabled: boolean) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export const useWebRTC = (
  signalingServer: string,
  iceServers: RTCConfiguration,
  callbacks?: WebRTCCallbacks,
) => {
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [signalingConnected, setSignalingConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentRoomRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isReconnectingRef = useRef(false);

  const { stats, resetStats } = useConnectionStats(
    peerConnectionRef.current,
    connected,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    socketRef.current = io(signalingServer, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      setSignalingConnected(true);

      if (currentRoomRef.current && localStreamRef.current) {
        console.log(
          "Rejoining room after reconnection:",
          currentRoomRef.current,
        );

        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }
        createPeerConnection();

        socket.emit("join-room", currentRoomRef.current);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      setSignalingConnected(false);

      if (mountedRef.current) {
        setConnected(false);
        callbacks?.onDisconnected?.();
      }

      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Socket reconnected after", attemptNumber, "attempts");
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("Reconnection attempt:", attemptNumber);
    });

    socket.on("reconnect_error", (error) => {
      console.error("Reconnection error:", error);
    });

    socket.on("reconnect_failed", () => {
      console.error("Reconnection failed");
      alert("Unable to reconnect to server. Please refresh the page.");
    });

    socket.on("room-full", () => {
      alert("Room is full. Maximum 2 users allowed.");
      cleanupAll();
      window.location.reload();
    });

    socket.on("peer-audio-toggle", (enabled: boolean) => {
      setRemoteAudioEnabled(enabled);
      callbacks?.onRemoteAudioToggle?.(enabled);
    });

    socket.on("peer-video-toggle", (enabled: boolean) => {
      setRemoteVideoEnabled(enabled);
      callbacks?.onRemoteVideoToggle?.(enabled);
    });

    socket.on("ready", async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { roomId: currentRoomRef.current, offer });
      } catch (error) {
        console.error("Offer error:", error);
      }
    });

    socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
      try {
        let pc = peerConnectionRef.current;
        if (!pc) {
          pc = createPeerConnection();
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { roomId: currentRoomRef.current, answer });
      } catch (error) {
        console.error("Answer error:", error);
      }
    });

    socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        flushPendingCandidates();
      }
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (e) {
        console.error("ICE error:", e);
      }
    });

    socket.on("ice-restart", async () => {
      console.log("ICE restart requested by peer");
      await handleIceRestart();
    });

    socket.on("user-disconnected", () => {
      if (mountedRef.current) {
        setConnected(false);
        setRemoteStream(null);
        resetStats();
        setRemoteAudioEnabled(true);
        setRemoteVideoEnabled(true);
        callbacks?.onDisconnected?.();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (currentRoomRef.current && localStreamRef.current) {
        createPeerConnection();
      }
    });

    return () => {
      socket.disconnect();
      cleanupAll();
    };
  }, [signalingServer]);

  function flushPendingCandidates() {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    pendingCandidatesRef.current.forEach(async (candidate) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Queued ICE error:", e);
      }
    });
    pendingCandidatesRef.current = [];
  }

  async function handleIceRestart() {
    const pc = peerConnectionRef.current;
    if (!pc || isReconnectingRef.current) return;

    isReconnectingRef.current = true;

    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("offer", {
        roomId: currentRoomRef.current,
        offer,
      });
      console.log("ICE restart offer sent");
    } catch (error) {
      console.error("ICE restart failed:", error);
    } finally {
      isReconnectingRef.current = false;
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeoutRef.current) return;

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log("Attempting reconnection...");
      handleIceRestart();
      reconnectTimeoutRef.current = null;
    }, 3000) as unknown as number;
  }

  function createPeerConnection(): RTCPeerConnection {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    pendingCandidatesRef.current = [];

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          roomId: currentRoomRef.current,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream((prev) => {
        const next = new MediaStream(prev ? prev.getTracks() : []);
        if (!next.getTracks().find((t) => t.id === event.track.id)) {
          next.addTrack(event.track);
        }
        return next;
      });
      if (mountedRef.current) {
        setConnected(true);
        callbacks?.onConnected?.();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);

      if (pc.iceConnectionState === "disconnected") {
        console.log("Connection lost, attempting ICE restart...");
        scheduleReconnect();
      }

      if (pc.iceConnectionState === "failed") {
        console.log("Connection failed, forcing ICE restart...");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        handleIceRestart();
      }

      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        console.log("Connection restored");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        isReconnectingRef.current = false;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);

      if (["disconnected", "failed"].includes(pc.connectionState)) {
        if (mountedRef.current) {
          setConnected(false);
          callbacks?.onDisconnected?.();
        }
      }

      if (pc.connectionState === "closed") {
        if (mountedRef.current) {
          setConnected(false);
          setRemoteStream(null);
          resetStats();
          setRemoteAudioEnabled(true);
          setRemoteVideoEnabled(true);
          callbacks?.onDisconnected?.();
        }
      }
    };

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    return pc;
  }

  function cleanupAll() {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (mountedRef.current) {
      setConnected(false);
      setRemoteStream(null);
      resetStats();
      setRemoteAudioEnabled(true);
      setRemoteVideoEnabled(true);
    }
    localStreamRef.current = null;
  }

  const setLocalStream = (stream: MediaStream | null) => {
    localStreamRef.current = stream;
    if (stream && currentRoomRef.current && !peerConnectionRef.current) {
      createPeerConnection();
    }
  };

  const joinRoom = (roomId: string, stream: MediaStream) => {
    localStreamRef.current = stream;
    currentRoomRef.current = roomId;
    createPeerConnection();
    socketRef.current?.emit("join-room", roomId);
  };

  const leaveRoom = () => {
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit("leave-room", currentRoomRef.current);
    }
    cleanupAll();
    currentRoomRef.current = "";
  };

  const notifyPeerAudioToggle = (enabled: boolean) => {
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit("audio-toggle", {
        roomId: currentRoomRef.current,
        enabled,
      });
    }
  };

  const notifyPeerVideoToggle = (enabled: boolean) => {
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit("video-toggle", {
        roomId: currentRoomRef.current,
        enabled,
      });
    }
  };

  const replaceVideoTrack = async (newTrack: MediaStreamTrack) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    } catch (error) {
      console.error("Error replacing video track:", error);
    }
  };

  return {
    connected,
    signalingConnected,
    stats,
    remoteStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    setLocalStream,
    joinRoom,
    leaveRoom,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
    replaceVideoTrack,
  };
};
