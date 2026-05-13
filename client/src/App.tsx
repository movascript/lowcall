// App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { useWebRTC } from "./hooks/useWebRTC";
import { useMediaControls } from "./hooks/useMediaControls";
import { iceServers, signalingServer } from "./utils/constants";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  PhoneOff,
  UserCircle,
  Loader2,
} from "lucide-react";

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
            <img src="favicon.svg" alt="" />
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
                <Loader2 className="spinner" size={48} />
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
                  <UserCircle size={48} color="white" />
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
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            <button
              onClick={toggleVideo}
              className={`control-btn ${!videoEnabled ? "disabled" : ""}`}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button
              onClick={toggleSpeaker}
              className={`control-btn ${speakerMode ? "active" : ""}`}
              title={speakerMode ? "Speaker mode" : "Earpiece mode"}
            >
              {speakerMode ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>

            <button onClick={handleLeaveCall} className="control-btn end-call">
              <PhoneOff size={24} />
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
