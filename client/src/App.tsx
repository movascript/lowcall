// src/App.tsx
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
  Phone,
  Loader2,
} from "lucide-react";
import { DraggableVideo } from "./components/DraggableVideo";
import { ConnectionStats } from "./components/ConnectionStats";
import { ControlButton } from "./components/ControlButton";
import { cn } from "./utils/classname";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [showStats, setShowStats] = useState(false);

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
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (
      remoteVideoRef.current?.srcObject &&
      "setSinkId" in remoteVideoRef.current
    ) {
      remoteVideoRef.current
        .setSinkId(speakerMode ? "default" : "")
        .catch((err: Error) => {
          console.error("Error setting audio output:", err);
        });
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
    setShowStats(false);
  };

  return (
    <div className="w-screen h-screen bg-linear-to-br from-primary via-primary to-accent overflow-hidden">
      {!joined ? (
        <div className="flex items-center justify-center h-full p-5">
          <div className="bg-card animate-in fade-in-50 slide-in-from-bottom-5 rounded-3xl p-10 shadow-2xl max-w-md w-full">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 border rounded-2xl mb-4">
                <img className="w-10 h-10 text-white" src="favicon.svg" />
              </div>
              <h1 className="text-3xl font-bold text-card-foreground mb-2">
                lowcall
              </h1>
              <p className="text-sm text-muted-foreground">
                Simple, fast video calls
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter room code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                className="w-full px-4 py-3.5 text-base border-2 border-border rounded-xl outline-none transition-all focus:border-primary focus:shadow-[0_0_0_4px_rgba(102,126,234,0.1)]"
                autoFocus
              />
              <button
                onClick={handleJoinRoom}
                disabled={!roomId.trim()}
                className={cn(
                  "w-full py-3.5 text-base font-semibold text-primary-foreground bg-linear-to-r from-primary to-accent border-none rounded-xl cursor-pointer transition-all",
                  roomId.trim()
                    ? "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                    : "opacity-50 cursor-not-allowed",
                )}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 relative bg-black overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                !connected && "opacity-0",
              )}
            />

            {!connected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-br from-gray-900 to-black text-white z-10">
                <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                <p className="text-lg font-medium">Connecting...</p>
                <p className="text-sm text-white/60 mt-2">Room: {roomId}</p>
              </div>
            )}

            {connected && (
              <ConnectionStats
                stats={stats}
                showStats={showStats}
                onToggle={setShowStats}
              />
            )}

            <DraggableVideo
              videoRef={localVideoRef}
              videoEnabled={videoEnabled}
              connected={connected}
            />
          </div>

          <div className="flex items-center justify-center gap-3 px-6 py-5 bg-black/90 backdrop-blur-xl border-t border-white/10">
            <ControlButton
              icon={audioEnabled ? Mic : MicOff}
              onClick={toggleAudio}
              active={audioEnabled}
            />
            <ControlButton
              icon={videoEnabled ? Video : VideoOff}
              onClick={toggleVideo}
              active={videoEnabled}
            />
            <ControlButton
              icon={speakerMode ? Volume2 : VolumeX}
              onClick={toggleSpeaker}
              active={speakerMode}
              variant="primary"
            />
            <ControlButton
              icon={Phone}
              iconClassname="rotate-135"
              onClick={handleLeaveCall}
              variant="danger"
              size="lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
