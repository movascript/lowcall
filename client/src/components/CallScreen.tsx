import { useEffect, useRef, useState } from "react";
import {
  CameraOff,
  MicOff,
  SwitchCamera,
  Server,
  Copy,
  Check,
  MonitorX,
} from "lucide-react";
import { DraggableVideo } from "./DraggableVideo";
import { ConnectionStats } from "./ConnectionStats";
import { cn } from "../utils/classname";
import ControlBar from "./ControlBar";
import { Spinner } from "../ui/Spinner";
import TopBarButton from "./TopBarButton";
import TopBar from "./TopBar";
import { ChatPanel } from "./ChatPanel";
import { ReactionOverlay } from "./ReactionOverlay";
import { CallBanner } from "./CallBanner";
import { roomUrl } from "../utils/helper";
import type { useVideoCall } from "../hooks/useVideoCall";

type Call = ReturnType<typeof useVideoCall>;

interface CallScreenProps {
  roomId: string;
  call: Call;
  onLeave: () => void;
}

export function CallScreen({ roomId, call, onLeave }: CallScreenProps) {
  const [showStats, setShowStats] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenRef = useRef<HTMLVideoElement>(null);
  const remoteCameraPipRef = useRef<HTMLVideoElement>(null);

  const {
    connected,
    signalingConnected,
    stats,
    iceState,
    peerLeft,
    localStream,
    remoteStream,
    remoteScreenStream,
    audioEnabled,
    videoEnabled,
    hdEnabled,
    canSwitchCamera,
    remoteAudioEnabled,
    remoteVideoEnabled,
    remoteScreenSharing,
    localScreenSharing,
    facingMode,
    speakerId,
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
    startScreenShare,
    stopScreenShare,
    collab,
  } = call;

  const showScreen =
    remoteScreenSharing && Boolean(remoteScreenStream?.getVideoTracks().length);
  const reconnecting =
    connected === false &&
    (iceState === "disconnected" || iceState === "failed") &&
    !peerLeft;
  const poorNetwork =
    stats.quality.qualityLimitationReason === "bandwidth" ||
    stats.connection.packetLoss >= 8;

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (remoteCameraPipRef.current) {
      remoteCameraPipRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteScreenRef.current) {
      remoteScreenRef.current.srcObject = remoteScreenStream || null;
    }
  }, [remoteScreenStream]);

  useEffect(() => {
    const el = remoteVideoRef.current as
      | (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (el?.setSinkId && speakerId) {
      void el.setSinkId(speakerId);
    }
  }, [speakerId, remoteStream]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(roomId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleScreen = async () => {
    try {
      setScreenError(null);
      if (localScreenSharing) await stopScreenShare();
      else await startScreenShare();
    } catch (error) {
      setScreenError(
        error instanceof Error
          ? error.message
          : "Screen share failed. The call is still going.",
      );
    }
  };

  return (
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
            (!connected || showScreen) && "opacity-0",
          )}
        />
        <video
          ref={remoteScreenRef}
          autoPlay
          playsInline
          disablePictureInPicture
          className={cn(
            "absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-500",
            showScreen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        />

        {connected && !remoteVideoEnabled && !showScreen && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                <CameraOff className="w-12 h-12 text-gray-400" />
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
            <div className="flex flex-col gap-2 items-center mt-10">
              <div className="flex gap-2 items-center">
                <Spinner variant="ring" className="w-8 h-8 text-primary" />
                <p className="text-sm text-white/70">
                  {peerLeft
                    ? "They left — waiting for someone to join"
                    : "Waiting for someone to join"}
                </p>
              </div>
              <p className="text-xs text-white/50">Room {roomId}</p>
              <button
                type="button"
                onClick={copyLink}
                className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                Copy link
              </button>
            </div>
          </div>
        )}

        {reconnecting && (
          <CallBanner tone="warn">Reconnecting…</CallBanner>
        )}
        {!signalingConnected && connected && (
          <CallBanner tone="danger">Signaling server disconnected</CallBanner>
        )}
        {connected && poorNetwork && !reconnecting && (
          <CallBanner tone="warn">Unstable network</CallBanner>
        )}
        {localScreenSharing && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm shadow-lg">
            You are sharing your screen
            <button
              type="button"
              onClick={() => void handleScreen()}
              className="flex items-center gap-1 font-semibold underline"
            >
              <MonitorX size={14} /> Stop
            </button>
          </div>
        )}
        {screenError && (
          <CallBanner tone="danger">{screenError}</CallBanner>
        )}

        <ReactionOverlay reactions={collab.callReactions} />

        <TopBar>
          <div className="flex gap-2">
            {connected && (
              <ConnectionStats
                stats={stats}
                showStats={showStats}
                onToggle={setShowStats}
              />
            )}
            <TopBarButton
              onClick={copyLink}
              Icon={copied ? Check : Copy}
              title="Copy room link"
            />
            <TopBarButton
              onClick={() => {}}
              Icon={Server}
              title={
                signalingConnected
                  ? "Signaling server connected"
                  : "Signaling server disconnected"
              }
              iconColor={signalingConnected ? "#10b981" : "#ef4444"}
            />
          </div>

          <div>
            {connected && canSwitchCamera && (
              <TopBarButton
                onClick={() => void switchCamera()}
                Icon={SwitchCamera}
                title="Switch camera"
              />
            )}
          </div>
        </TopBar>

        {showScreen && (
          <DraggableVideo
            videoRef={remoteCameraPipRef}
            videoEnabled={remoteVideoEnabled}
            audioEnabled={remoteAudioEnabled}
            connected
            mirror={false}
            corner="left"
          />
        )}

        <DraggableVideo
          videoRef={localVideoRef}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          connected={connected}
          facingMode={facingMode}
          corner="right"
        />

        <ChatPanel
          open={collab.panelOpen}
          ready={collab.chatReady}
          messages={collab.messages}
          onClose={collab.closePanel}
          onSend={collab.sendChat}
          onReact={collab.toggleMessageReaction}
          onSendFile={(file) => void collab.sendFile(file)}
        />
      </div>

      <ControlBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        hdEnabled={hdEnabled}
        localScreenSharing={localScreenSharing}
        chatOpen={collab.panelOpen}
        unread={collab.unread}
        reactionOpen={reactionOpen}
        onToggleAudio={() => void toggleAudio()}
        onToggleVideo={() => void toggleVideo()}
        onToggleHD={() => void toggleHD()}
        onToggleScreen={() => void handleScreen()}
        onToggleChat={() =>
          collab.panelOpen ? collab.closePanel() : collab.openPanel()
        }
        onToggleReactions={() => setReactionOpen((v) => !v)}
        onReact={(emoji) => {
          collab.sendCallReaction(emoji);
          setReactionOpen(false);
        }}
        onLeave={onLeave}
      />
    </div>
  );
}
