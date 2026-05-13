import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

export interface Stats {
  ping: number;
  bitrate: number;
  packetLoss: number;
  protocol: string;
  candidateType: string;
  networkType: string;
  localAddress: string;
  remoteAddress: string;
}

const initialStats: Stats = {
  ping: 0,
  bitrate: 0,
  packetLoss: 0,
  protocol: "N/A",
  candidateType: "N/A",
  networkType: "N/A",
  localAddress: "N/A",
  remoteAddress: "N/A",
};

export const useWebRTC = (
  signalingServer: string,
  iceServers: RTCConfiguration,
) => {
  const [connected, setConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef<string>("");

  // Single source of truth for socket initialization
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
      }
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        }
      } catch (e) {
        console.error("ICE error:", e);
      }
    });

    socket.on("user-disconnected", () => {
      setConnected(false);
      setRemoteStream(null);
      setStats(initialStats);
      stopStatsMonitoring();
      // Recreate peer connection for potential reconnect
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (currentRoomRef.current) {
        createPeerConnection();
      }
    });

    return () => {
      socket.disconnect();
      cleanupAll();
    };
  }, [signalingServer]); // Only recreate socket if server changes

  // Peer connection factory - not a callback, just a function
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
      setRemoteStream((prevStream) => {
        const stream = prevStream || new MediaStream();
        if (!stream.getTracks().includes(event.track)) {
          stream.addTrack(event.track);
        }
        return stream;
      });
      setConnected(true);
      startStatsMonitoring();
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        setConnected(false);
        setRemoteStream(null);
        setStats(initialStats);
        stopStatsMonitoring();
      }
    };

    // Add local tracks if available
    const stream = localStream;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    return pc;
  }

  function startStatsMonitoring() {
    if (statsIntervalRef.current) return; // Already running

    statsIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        const statsReport = await pc.getStats();
        let bitrate = 0,
          packetLoss = 0,
          rtt = 0;
        let protocol = "N/A",
          candidateType = "N/A",
          networkType = "N/A";
        let localAddress = "N/A",
          remoteAddress = "N/A";
        let localCandidateId = "",
          remoteCandidateId = "";

        statsReport.forEach((report) => {
          if (report.type === "inbound-rtp" && report.mediaType === "video") {
            if (report.bytesReceived)
              bitrate = Math.round((report.bytesReceived * 8) / 1000);
            if (report.packetsLost && report.packetsReceived) {
              packetLoss = Math.round(
                (report.packetsLost /
                  (report.packetsLost + report.packetsReceived)) *
                  100,
              );
            }
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

        const connectionMethod =
          candidateType === "relay"
            ? "TURN"
            : candidateType === "srflx"
              ? "STUN"
              : candidateType === "host"
                ? "P2P"
                : candidateType.toUpperCase();

        setStats({
          ping: rtt,
          bitrate,
          packetLoss,
          protocol,
          candidateType: connectionMethod,
          networkType,
          localAddress,
          remoteAddress,
        });
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
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    stopStatsMonitoring();
    setLocalStream(null);
    setConnected(false);
    setRemoteStream(null);
    setStats(initialStats);
  }

  // Create peer connection when local stream is ready
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

      setLocalStream(stream);
      currentRoomRef.current = roomId;

      // Socket is already initialized in the effect
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
