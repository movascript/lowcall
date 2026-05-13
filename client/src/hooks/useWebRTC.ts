// hooks/useWebRTC.ts
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

export const useWebRTC = (
  signalingServer: string,
  iceServers: RTCConfiguration,
) => {
  const [connected, setConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<Stats>({
    ping: 0,
    bitrate: 0,
    packetLoss: 0,
    protocol: "N/A",
    candidateType: "N/A",
    networkType: "N/A",
    localAddress: "N/A",
    remoteAddress: "N/A",
  });

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef<string>("");

  const startStatsMonitoring = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnectionRef.current) return;

      const statsReport = await peerConnectionRef.current.getStats();
      let bitrate = 0;
      let packetLoss = 0;
      let rtt = 0;
      let protocol = "N/A";
      let candidateType = "N/A";
      let networkType = "N/A";
      let localAddress = "N/A";
      let remoteAddress = "N/A";

      let localCandidateId = "";
      let remoteCandidateId = "";

      statsReport.forEach((report) => {
        console.log(report);
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          if (report.bytesReceived) {
            bitrate = Math.round((report.bytesReceived * 8) / 1000);
          }
          if (report.packetsLost && report.packetsReceived) {
            packetLoss = Math.round(
              (report.packetsLost /
                (report.packetsLost + report.packetsReceived)) *
                100,
            );
          }
        }

        if (report.type === "candidate-pair" && report.state === "succeeded") {
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
    }, 1000) as unknown as number;
  };

  const handleRemoteDisconnect = () => {
    setConnected(false);
    setRemoteStream(null);

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (currentRoomRef.current && localStream) {
      createPeerConnection();
      localStream.getTracks().forEach((track) => {
        peerConnectionRef.current!.addTrack(track, localStream);
      });
    }
  };

  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(iceServers);

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          roomId: currentRoomRef.current,
          candidate: event.candidate,
        });
        console.log("ICE candidate sent");
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      console.log("Remote track received");
      setRemoteStream(event.streams[0]);
      setConnected(true);
      startStatsMonitoring();
    };

    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current?.connectionState;
      console.log("Connection state:", state);

      if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        handleRemoteDisconnect();
      }
    };

    peerConnectionRef.current.oniceconnectionstatechange = () => {
      const state = peerConnectionRef.current?.iceConnectionState;
      console.log("ICE connection state:", state);

      if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        handleRemoteDisconnect();
      }
    };
  };

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on("ready", async () => {
      console.log("Ready event received, creating offer...");
      try {
        if (!peerConnectionRef.current) return;

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current?.emit("offer", {
          roomId: currentRoomRef.current,
          offer,
        });
        console.log("Offer sent");
      } catch (error) {
        console.error("Error creating offer:", error);
      }
    });

    socketRef.current.on("offer", async (offer: RTCSessionDescriptionInit) => {
      console.log("Offer received, creating answer...");
      try {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socketRef.current?.emit("answer", {
          roomId: currentRoomRef.current,
          answer,
        });
        console.log("Answer sent");
      } catch (error) {
        console.error("Error creating answer:", error);
      }
    });

    socketRef.current.on(
      "answer",
      async (answer: RTCSessionDescriptionInit) => {
        console.log("Answer received");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
        }
      },
    );

    socketRef.current.on(
      "ice-candidate",
      async (candidate: RTCIceCandidateInit) => {
        console.log("ICE candidate received");
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate),
            );
          }
        } catch (e) {
          console.error("Error adding ICE candidate:", e);
        }
      },
    );

    socketRef.current.on("user-disconnected", () => {
      console.log("User disconnected");
      handleRemoteDisconnect();
    });
  };

  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      setLocalStream(stream);
      currentRoomRef.current = roomId;

      createPeerConnection();

      if (peerConnectionRef.current) {
        stream.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, stream);
        });
      }

      socketRef.current?.emit("join-room", roomId);
      console.log("Joined room:", roomId);

      return stream;
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      throw error;
    }
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave-room", currentRoomRef.current);
    cleanup();
    currentRoomRef.current = "";
    socketRef.current = io(signalingServer);
    setupSocketListeners();
  };

  useEffect(() => {
    socketRef.current = io(signalingServer);
    setupSocketListeners();

    return () => {
      cleanup();
    };
  }, []);

  return {
    connected,
    stats,
    localStream,
    remoteStream,
    joinRoom,
    leaveRoom,
  };
};
