import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import type { ConnectionStatus } from "../types";

const initialStats: ConnectionStatus = {
  ping: 0,
  bitrateReceived: 0,
  bitrateSent: 0,
  packetLoss: 0,
  protocol: "N/A",
  candidateType: "N/A",
  networkType: "N/A",
  localAddress: "N/A",
  remoteAddress: "N/A",
  totalBytesReceived: 0,
  totalBytesSent: 0,
};

export const useWebRTC = (
  signalingServer: string,
  iceServers: RTCConfiguration,
) => {
  const [connected, setConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<ConnectionStatus>(initialStats);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const prevBytesReceivedRef = useRef(0);
  const prevBytesSentRef = useRef(0);
  const prevTimeRef = useRef(Date.now());

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    socketRef.current = io(signalingServer);

    const socket = socketRef.current;

    // All socket listeners in one place
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

    socket.on("user-disconnected", () => {
      if (mountedRef.current) {
        setConnected(false);
        setRemoteStream(null);
        setStats(initialStats);
      }
      stopStatsMonitoring();
      // Recreate peer connection for potential reconnect
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

  function createPeerConnection(): RTCPeerConnection {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

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
      if (mountedRef.current) setConnected(true);
      startStatsMonitoring();
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        if (mountedRef.current) {
          setConnected(false);
          setRemoteStream(null);
          setStats(initialStats);
        }
        stopStatsMonitoring();
      }
    };

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    return pc;
  }

  function startStatsMonitoring() {
    stopStatsMonitoring();
    prevBytesReceivedRef.current = 0;
    prevBytesSentRef.current = 0;
    prevTimeRef.current = Date.now();

    statsIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        const statsReport = await pc.getStats();
        let bytesReceived = 0,
          bytesSent = 0,
          packetLoss = 0,
          rtt = 0,
          protocol = "N/A",
          candidateType = "N/A",
          networkType = "N/A",
          localAddress = "N/A",
          remoteAddress = "N/A",
          localCandidateId = "",
          remoteCandidateId = "";

        statsReport.forEach((report) => {
          if (report.type === "inbound-rtp" && report.mediaType === "video") {
            if (report.bytesReceived) bytesReceived += report.bytesReceived;
            if (report.packetsLost && report.packetsReceived) {
              packetLoss = Math.round(
                (report.packetsLost /
                  (report.packetsLost + report.packetsReceived)) *
                  100,
              );
            }
          }
          if (report.type === "outbound-rtp" && report.mediaType === "video") {
            if (report.bytesSent) bytesSent += report.bytesSent;
          }
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            rtt = report.currentRoundTripTime
              ? Math.round(report.currentRoundTripTime * 1000)
              : 0;
            localCandidateId = report.localCandidateId;
            remoteCandidateId = report.remoteCandidateId;
          }
        });

        statsReport.forEach((report) => {
          if (
            report.type === "local-candidate" &&
            report.id === localCandidateId
          ) {
            protocol = report.protocol?.toUpperCase() || "N/A";
            candidateType = report.candidateType || "N/A";
            networkType = report.networkType || "N/A";
            localAddress = report.address
              ? `${report.address}:${report.port}`
              : "N/A";
          }
          if (
            report.type === "remote-candidate" &&
            report.id === remoteCandidateId
          ) {
            remoteAddress = report.address
              ? `${report.address}:${report.port}`
              : "N/A";
          }
        });

        const now = Date.now();
        const dt = (now - prevTimeRef.current) / 1000;

        const bitrateReceived =
          dt > 0
            ? Math.round((bytesReceived - prevBytesReceivedRef.current) / dt)
            : 0;

        const bitrateSent =
          dt > 0 ? Math.round((bytesSent - prevBytesSentRef.current) / dt) : 0;

        prevBytesReceivedRef.current = bytesReceived;
        prevBytesSentRef.current = bytesSent;
        prevTimeRef.current = now;

        const connectionMethod =
          candidateType === "relay"
            ? "TURN"
            : candidateType === "srflx"
              ? "STUN"
              : candidateType === "host"
                ? "P2P"
                : candidateType.toUpperCase();

        if (mountedRef.current) {
          setStats({
            ping: rtt,
            bitrateReceived,
            bitrateSent,
            packetLoss,
            protocol,
            candidateType: connectionMethod,
            networkType,
            localAddress,
            remoteAddress,
            totalBytesReceived: bytesReceived,
            totalBytesSent: bytesSent,
          });
        }
      } catch (err) {
        console.error("Stats error:", err);
      }
    }, 1000) as unknown as number;
  }

  function stopStatsMonitoring() {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }

  function cleanupAll() {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    stopStatsMonitoring();
    if (mountedRef.current) {
      setLocalStream(null);
      setConnected(false);
      setRemoteStream(null);
      setStats(initialStats);
    }
    localStreamRef.current = null;
  }

  useEffect(() => {
    if (localStream && currentRoomRef.current && !peerConnectionRef.current) {
      createPeerConnection();
    }
  }, [localStream]);

  const joinRoom = async (roomId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      currentRoomRef.current = roomId;
      setLocalStream(stream);
      socketRef.current?.emit("join-room", roomId);
      return stream;
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      throw error;
    }
  };

  const leaveRoom = () => {
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit("leave-room", currentRoomRef.current);
    }
    cleanupAll();
    currentRoomRef.current = "";
  };

  return { connected, stats, localStream, remoteStream, joinRoom, leaveRoom };
};
