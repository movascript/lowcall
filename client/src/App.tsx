// src/App.tsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { useWebRTC } from "./hooks/useWebRTC";
import { useMediaControls } from "./hooks/useMediaControls";
import { iceServers, signalingServer } from "./utils/constants";
import { Loader2, MicOff, VideoOff } from "lucide-react";
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
    localStream,
    remoteStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    joinRoom,
    leaveRoom,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
  } = useWebRTC(signalingServer, iceServers);

  console.log("au", remoteAudioEnabled, remoteVideoEnabled);

  useDialingSound(joined, connected);

  const {
    audioEnabled,
    videoEnabled,
    canSwitchCamera,
    toggleAudio,
    toggleVideo,
    switchCamera,
  } = useMediaControls(
    localStream,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
  );

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

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
              disablePictureInPicture
              disableRemotePlayback
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                !connected && "opacity-0",
              )}
            />

            {/* Remote user mute indicators */}
            {connected && (
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                {!remoteAudioEnabled && (
                  <div className="bg-red-500/90 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                    <MicOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Muted</span>
                  </div>
                )}
                {!remoteVideoEnabled && (
                  <div className="bg-red-500/90 text-white px-3 py-2 rounded-lg flex items-center gap-2">
                    <VideoOff className="w-4 h-4" />
                    <span className="text-sm font-medium">Camera Off</span>
                  </div>
                )}
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
            canSwitchCamera={canSwitchCamera}
            toggleAudio={toggleAudio}
            toggleVideo={toggleVideo}
            switchCamera={switchCamera}
            handleLeaveCall={handleLeaveCall}
          />
        </div>
      )}
    </div>
  );
}

export default App;
