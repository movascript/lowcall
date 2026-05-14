// src/App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { useWebRTC } from "./hooks/useWebRTC";
import { useMediaControls } from "./hooks/useMediaControls";
import { iceServers, signalingServer } from "./utils/constants";
import { Loader2 } from "lucide-react";
import { DraggableVideo } from "./components/DraggableVideo";
import { ConnectionStats } from "./components/ConnectionStats";
import { cn } from "./utils/classname";
import { useDialingSound } from "./hooks/useDialingSound";
import ControlBar from "./components/ControlBar";
import LandingPage from "./components/LandingPage";
import { usePreventRefresh } from "./hooks/usePreventRefresh";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const { connected, stats, localStream, remoteStream, joinRoom, leaveRoom } =
    useWebRTC(signalingServer, iceServers);

  useDialingSound(joined, connected);

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

  // Prevent accidental refresh/close when in call
  usePreventRefresh(joined && connected);

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
    if (!roomId.toLowerCase().trim()) return;
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
        <LandingPage
          roomId={roomId}
          setRoomId={setRoomId}
          handleJoinRoom={handleJoinRoom}
        />
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
              <div className="absolute inset-0 flex justify-center bg-linear-to-br from-gray-900 to-black text-white z-10">
                <div className="flex gap-2 h-0 items-center justify-center mt-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-lg font-medium">Connecting...</p>
                  <p className="text-sm text-white/60">Room: {roomId}</p>
                </div>
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

          <ControlBar
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            speakerMode={speakerMode}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            toggleSpeaker={toggleSpeaker}
            handleLeaveCall={handleLeaveCall}
          />
        </div>
      )}
    </div>
  );
}

export default App;
