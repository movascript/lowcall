// src/App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { useVideoCall } from "./hooks/useVideoCall";
import { Loader2, MicOff, VideoOff, SwitchCamera } from "lucide-react";
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

  const {
    connected,
    stats,
    callDuration,
    localStream,
    remoteStream,
    audioEnabled,
    videoEnabled,
    canSwitchCamera,
    remoteAudioEnabled,
    remoteVideoEnabled,
    toggleAudio,
    toggleVideo,
    switchCamera,
    joinRoom,
    leaveRoom,
  } = useVideoCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useDialingSound(joined, connected);
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
              disablePictureInPicture
              disableRemotePlayback
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                !connected && "opacity-0",
              )}
            />

            {connected && !remoteVideoEnabled && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                    <VideoOff className="w-12 h-12 text-white/60" />
                  </div>
                  <span className="text-white/80 text-lg font-medium">
                    Camera Off
                  </span>
                </div>
              </div>
            )}

            {connected && !remoteAudioEnabled && (
              <div className="absolute top-20 left-5 z-20">
                <div className="bg-red-500/90 backdrop-blur-sm text-white px-3 py-2 rounded-full flex items-center gap-2 shadow-lg">
                  <MicOff className="w-4 h-4" />
                  <span className="text-sm font-medium">Muted</span>
                </div>
              </div>
            )}

            {!connected && (
              <div className="absolute inset-0 flex justify-center bg-linear-to-br from-gray-900 to-black text-white z-10">
                <div className="flex gap-2 h-0 items-center justify-center mt-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-lg font-medium">Connecting...</p>
                  <p className="text-sm text-white/60">Room: {roomId}</p>
                </div>
              </div>
            )}

            <ConnectionStats
              stats={stats}
              showStats={showStats}
              onToggle={setShowStats}
              callDuration={callDuration}
            />

            {connected && canSwitchCamera && (
              <button
                onClick={switchCamera}
                className="absolute top-5 right-5 z-30 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10 hover:scale-105 active:scale-95"
                title="Switch Camera"
              >
                <SwitchCamera size={20} />
              </button>
            )}

            <DraggableVideo
              videoRef={localVideoRef}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              connected={connected}
            />
          </div>

          <ControlBar
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            handleLeaveCall={handleLeaveCall}
          />
        </div>
      )}
    </div>
  );
}

export default App;
