// App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { useWebRTC } from "./hooks/useWebRTC";
import { useMediaControls } from "./hooks/useMediaControls";
import { iceServers, signalingServer } from "./utils/constants";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const { connected, stats, localStream, remoteStream, joinRoom, leaveRoom } =
    useWebRTC(signalingServer, iceServers);

  const {
    audioEnabled,
    videoEnabled,
    speakerMode,
    toggleAudio,
    toggleVideo,
    toggleSpeaker,
  } = useMediaControls(localStream);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  const handleJoinRoom = async () => {
    if (!roomId.trim()) return;

    try {
      await joinRoom(roomId);
      setJoined(true);
    } catch (error) {
      alert(`Camera/microphone access denied: ${(error as Error).message}`);
    }
  };

  const handleLeaveCall = () => {
    leaveRoom();
    setJoined(false);
    setRoomId("");
  };

  const getConnectionColor = () => {
    if (stats.candidateType === "P2P") return "#10b981";
    if (stats.candidateType === "STUN") return "#3b82f6";
    if (stats.candidateType === "TURN") return "#f59e0b";
    return "#6b7280";
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
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              className="room-input"
              autoFocus
            />
            <button onClick={handleJoinRoom} className="join-btn">
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

            <button onClick={handleLeaveCall} className="control-btn end-call">
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
            <div className="stats-container">
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label">Connection</div>
                  <div
                    className="stat-value"
                    style={{ color: getConnectionColor() }}
                  >
                    {stats.candidateType}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Protocol</div>
                  <div className="stat-value">{stats.protocol}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Latency</div>
                  <div className="stat-value">{stats.ping}ms</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Bitrate</div>
                  <div className="stat-value">{stats.bitrate} kbps</div>
                </div>
              </div>
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label">Packet Loss</div>
                  <div className="stat-value">{stats.packetLoss}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Network</div>
                  <div className="stat-value">{stats.networkType}</div>
                </div>
                <div className="stat-card wide">
                  <div className="stat-label">Local</div>
                  <div className="stat-value small">{stats.localAddress}</div>
                </div>
                <div className="stat-card wide">
                  <div className="stat-label">Remote</div>
                  <div className="stat-value small">{stats.remoteAddress}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
