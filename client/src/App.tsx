import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import "./App.css";

const SIGNALING_SERVER = "https://lowcall.ir";

const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface Stats {
  ping: number;
  bitrate: number;
  packetLoss: number;
}

function App() {
  const [roomId, setRoomId] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    ping: 0,
    bitrate: 0,
    packetLoss: 0,
  });

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef<string>("");

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER);

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
      setConnected(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  const joinRoom = async () => {
    if (!roomId.trim()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      currentRoomRef.current = roomId;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      createPeerConnection();

      if (peerConnectionRef.current) {
        stream.getTracks().forEach((track) => {
          peerConnectionRef.current!.addTrack(track, stream);
        });
      }

      socketRef.current?.emit("join-room", roomId);
      setJoined(true);
      console.log("Joined room:", roomId);
    } catch (error) {
      console.error("Error accessing camera/microphone:", error);
      alert(`Camera/microphone access denied: ${(error as Error).message}`);
    }
  };

  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(iceServers);

    peerConnectionRef.current.onicecandidate = (
      event: RTCPeerConnectionIceEvent,
    ) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          roomId: currentRoomRef.current,
          candidate: event.candidate,
        });
        console.log("ICE candidate sent");
      }
    };

    peerConnectionRef.current.ontrack = (event: RTCTrackEvent) => {
      console.log("Remote track received");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setConnected(true);
      startStatsMonitoring();
    };

    peerConnectionRef.current.onconnectionstatechange = () => {
      console.log(
        "Connection state:",
        peerConnectionRef.current?.connectionState,
      );
      if (peerConnectionRef.current?.connectionState === "disconnected") {
        setConnected(false);
      }
    };

    peerConnectionRef.current.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        peerConnectionRef.current?.iceConnectionState,
      );
    };
  };

  const startStatsMonitoring = () => {
    statsIntervalRef.current = setInterval(async () => {
      if (!peerConnectionRef.current) return;

      const statsReport = await peerConnectionRef.current.getStats();
      let bitrate = 0;
      let packetLoss = 0;
      let rtt = 0;

      statsReport.forEach((report) => {
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
        }
      });

      setStats({ ping: rtt, bitrate, packetLoss });
    }, 1000) as unknown as number;
  };

  return (
    <div className="App">
      <div className="header">
        <h1>WebRTC Video Call</h1>
      </div>

      {!joined ? (
        <div className="join-container">
          <input
            type="text"
            placeholder="Enter room code"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && joinRoom()}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <>
          <div className="video-container">
            <div className="video-wrapper">
              <video ref={localVideoRef} autoPlay muted playsInline />
              <span className="video-label">You</span>
            </div>
            <div className="video-wrapper">
              <video ref={remoteVideoRef} autoPlay playsInline />
              <span className="video-label">
                {connected ? "Remote User" : "Waiting for connection..."}
              </span>
            </div>
          </div>

          {connected && (
            <div className="stats">
              <span>Ping: {stats.ping}ms</span>
              <span>Bitrate: {stats.bitrate} kbps</span>
              <span>Packet Loss: {stats.packetLoss}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
