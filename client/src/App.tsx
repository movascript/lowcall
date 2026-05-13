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
    <div className="w-screen h-screen bg-linear-to-br from-primary via-primary to-accent overflow-hidden">
      {!joined ? (
        <div className="flex items-center justify-center h-full p-5">
          <div className="bg-card animate-in fade-in-50 slide-in-from-top-5 rounded-3xl p-12 shadow-2xl max-w-110 w-full text-center">
            <img src="favicon.svg" alt="" className="mx-auto mb-3" />
            <h1 className="text-[32px] font-bold text-card-foreground mb-3">
              Just Video Call
            </h1>
            <p className="text-base text-muted-foreground mb-8">
              Enter a room code to start or join a call
            </p>
            <input
              type="text"
              placeholder="Enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              className="w-full px-5 py-4 text-base border-2 border-border rounded-xl outline-none transition-all mb-5 focus:border-primary focus:shadow-[0_0_0_4px_rgba(102,126,234,0.1)]"
              autoFocus
            />
            <button
              onClick={handleJoinRoom}
              className="w-full py-4 text-base font-semibold text-primary-foreground bg-linear-to-br from-primary to-accent border-none rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(102,126,234,0.4)] active:translate-y-0"
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col relative">
          <div className="flex-1 relative bg-black overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!connected && (
              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/80 text-white z-10">
                <Loader2 className="w-12 h-12 animate-spin mb-5" />
                <p className="text-lg font-medium">Waiting for other user...</p>
              </div>
            )}

            <div
              className={`absolute top-5 right-5 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-300 z-20 ${
                connected ? "w-40 h-30" : "w-70 h-52.5"
              } max-md:w-30 max-md:h-22.5 max-md:top-4 max-md:right-4 ${
                connected ? "max-md:w-25 max-md:h-18.75" : ""
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!videoEnabled && (
                <div className="absolute top-0 left-0 w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                  <UserCircle size={48} color="white" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 px-6 py-6 bg-black/80 backdrop-blur-[10px] max-md:gap-3 max-md:p-4">
            <button
              onClick={toggleAudio}
              className={`w-14 h-14 rounded-full border-none flex items-center justify-center cursor-pointer transition-all text-white hover:bg-white/30 hover:scale-105 active:scale-95 max-md:w-12 max-md:h-12 ${
                !audioEnabled ? "bg-destructive/90" : "bg-white/20"
              }`}
              title={audioEnabled ? "Mute" : "Unmute"}
            >
              {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full border-none flex items-center justify-center cursor-pointer transition-all text-white hover:bg-white/30 hover:scale-105 active:scale-95 max-md:w-12 max-md:h-12 ${
                !videoEnabled ? "bg-destructive/90" : "bg-white/20"
              }`}
              title={videoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button
              onClick={toggleSpeaker}
              className={`w-14 h-14 rounded-full border-none flex items-center justify-center cursor-pointer transition-all text-white hover:bg-white/30 hover:scale-105 active:scale-95 max-md:w-12 max-md:h-12 ${
                speakerMode ? "bg-blue-500/90" : "bg-white/20"
              }`}
              title={speakerMode ? "Speaker mode" : "Earpiece mode"}
            >
              {speakerMode ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>

            <button
              onClick={handleLeaveCall}
              className="w-16 h-16 rounded-full border-none bg-destructive/90 text-white flex items-center justify-center cursor-pointer transition-all hover:bg-destructive hover:scale-105 active:scale-95 max-md:w-14 max-md:h-14"
            >
              <PhoneOff size={24} />
            </button>
          </div>

          {connected && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-[10px] rounded-xl p-4 flex flex-col gap-3 min-w-150 max-w-[90%] max-md:min-w-0 max-md:w-[90%]">
              <div className="flex gap-3 justify-between max-md:flex-wrap">
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Connection
                  </div>
                  <div
                    className="text-base text-white font-semibold"
                    style={{ color: getConnectionColor() }}
                  >
                    {stats.candidateType}
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Protocol
                  </div>
                  <div className="text-base text-white font-semibold">
                    {stats.protocol}
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Latency
                  </div>
                  <div className="text-base text-white font-semibold">
                    {stats.ping}ms
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Bitrate
                  </div>
                  <div className="text-base text-white font-semibold">
                    {stats.bitrate} kbps
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-between max-md:flex-wrap">
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Packet Loss
                  </div>
                  <div className="text-base text-white font-semibold">
                    {stats.packetLoss}%
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Network
                  </div>
                  <div className="text-base text-white font-semibold">
                    {stats.networkType}
                  </div>
                </div>
                <div className="flex-2 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Local
                  </div>
                  <div className="text-xs text-white font-semibold font-mono">
                    {stats.localAddress}
                  </div>
                </div>
                <div className="flex-2 bg-white/5 rounded-lg px-3 py-2 flex flex-col gap-1 min-w-20 max-md:min-w-[calc(50%-6px)]">
                  <div className="text-[11px] text-white/60 uppercase tracking-wider font-medium">
                    Remote
                  </div>
                  <div className="text-xs text-white font-semibold font-mono">
                    {stats.remoteAddress}
                  </div>
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
