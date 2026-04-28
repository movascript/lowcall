import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import "./App.css";

const SIGNALING_SERVER = "https://lowcall.ir";

const iceServers: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:lowcall.ir:3478", "turn:lowcall.ir:3478"],
      username: "myuser",
      credential: "mypassword",
    },
    // { urls: "stun:stun.l.google.com:19302" },
    // { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

interface Stats {
  ping: number;
  bitrate: number;
  packetLoss: number;
  connectionType: string;
}

function App() {
  const [roomId, setRoomId] = useState<string>("");
  const [joined, setJoined] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [videoEnabled, setVideoEnabled] = useState<boolean>(true);
  const [speakerMode, setSpeakerMode] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    ping: 0,
    bitrate: 0,
    packetLoss: 0,
    connectionType: "N/A",
  });

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const statsIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef<string>("");

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

  const handleRemoteDisconnect = () => {
    setConnected(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    // Recreate peer connection for potential reconnection
    if (joined && localStreamRef.current) {
      createPeerConnection();
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnectionRef.current!.addTrack(track, localStreamRef.current!);
      });
    }
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

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
      handleRemoteDisconnect();
    });

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      const videoElement = remoteVideoRef.current;
      if ("setSinkId" in videoElement) {
        videoElement
          .setSinkId(speakerMode ? "default" : "")
          .catch((err: Error) => {
            console.error("Error setting audio output:", err);
          });
      }
    }
  }, [speakerMode]);

  const joinRoom = async () => {
    if (!roomId.trim()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
      let connectionType = "N/A";

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

          // Get connection type (UDP/TCP)
          const localCandidateId = report.localCandidateId;
          const remoteCandidateId = report.remoteCandidateId;

          statsReport.forEach((candidateReport) => {
            if (
              candidateReport.id === localCandidateId ||
              candidateReport.id === remoteCandidateId
            ) {
              if (candidateReport.protocol) {
                connectionType = candidateReport.protocol.toUpperCase();
              }
            }
          });
        }
      });

      setStats({ ping: rtt, bitrate, packetLoss, connectionType });
    }, 1000) as unknown as number;
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setSpeakerMode(!speakerMode);
  };

  const leaveCall = () => {
    // Notify server before leaving
    socketRef.current?.emit("leave-room", currentRoomRef.current);

    // Clean up everything
    cleanup();

    // Reset state
    setJoined(false);
    setConnected(false);
    setRoomId("");
    currentRoomRef.current = "";

    // Reinitialize socket connection
    socketRef.current = io(SIGNALING_SERVER);

    // Re-setup socket listeners
    setupSocketListeners();
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

  return (
    <div className="App">
      {!joined ? (
        <div className="join-screen">
          <div className="join-card">
            <h1>Just Video Call</h1>
            <p>Enter a room code to start or join a call</p>
            <input
              type="text"
              placeholder="Enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              className="room-input"
            />
            <button onClick={joinRoom} className="join-btn">
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="call-screen">
          <div className={`video-container ${connected ? "connected" : ""}`}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            {!connected && (
              <div className="waiting-overlay">
                <div className="spinner"></div>
                <p>Waiting for other user...</p>
              </div>
            )}

            <div
              className={`local-video-wrapper ${connected ? "minimized" : ""}`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="local-video"
              />
              {!videoEnabled && (
                <div className="video-off-overlay">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="controls">
            <button
              onClick={toggleAudio}
              className={`control-btn ${!audioEnabled ? "disabled" : ""}`}
              title={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
              )}
            </button>

            <button
              onClick={toggleVideo}
              className={`control-btn ${!videoEnabled ? "disabled" : ""}`}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {videoEnabled ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
                </svg>
              )}
            </button>

            <button
              onClick={toggleSpeaker}
              className={`control-btn ${speakerMode ? "active" : ""}`}
              title={speakerMode ? "Speaker mode" : "Earpiece mode"}
            >
              {speakerMode ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                </svg>
              )}
            </button>

            <button onClick={leaveCall} className="control-btn end-call">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </button>
          </div>

          {connected && (
            <div className="stats-bar">
              <span className="stat-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="12" r="2" />
                </svg>
                {stats.ping}ms
              </span>
              <span className="stat-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
                {stats.bitrate} kbps
              </span>
              <span className="stat-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                </svg>
                {stats.packetLoss}%
              </span>
              <span className="stat-item">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                {stats.connectionType}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
