import { useCallback, useState } from "react";
import {
  MicOff,
  SwitchCamera,
  Server,
  Copy,
  Check,
  MonitorX,
} from "lucide-react";
import { VideoTile, type VideoTileId } from "./VideoTile";
import { ConnectionStats } from "./ConnectionStats";
import ControlBar from "./ControlBar";
import { Spinner } from "../ui/Spinner";
import TopBarButton from "./TopBarButton";
import TopBar from "./TopBar";
import { ChatPanel } from "./ChatPanel";
import { ReactionOverlay } from "./ReactionOverlay";
import { CallBanner } from "./CallBanner";
import { roomUrl } from "../utils/helper";
import { useCallSounds } from "../hooks/useCallSounds";
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
  const [pinned, setPinned] = useState<VideoTileId | null>(null);

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

  useCallSounds({ connected, messages: collab.messages });

  const defaultSpotlight: VideoTileId = !connected
    ? "local"
    : showScreen
      ? "screen"
      : "remote";
  const pinnedValid =
    pinned === "local" ||
    (pinned === "remote" && connected) ||
    (pinned === "screen" && showScreen);
  const spotlight: VideoTileId = pinnedValid && pinned ? pinned : defaultSpotlight;

  const reconnecting =
    connected === false &&
    (iceState === "disconnected" || iceState === "failed") &&
    !peerLeft;
  const poorNetwork =
    stats.quality.qualityLimitationReason === "bandwidth" ||
    stats.connection.packetLoss >= 8;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(roomId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [roomId]);

  const handleScreen = useCallback(async () => {
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
  }, [localScreenSharing, startScreenShare, stopScreenShare]);

  const promote = useCallback((id: VideoTileId) => {
    setPinned(id);
  }, []);

  const toggleReactions = useCallback(() => {
    setReactionOpen((v) => !v);
  }, []);

  const sendReaction = useCallback(
    (emoji: string) => {
      collab.sendCallReaction(emoji);
    },
    [collab],
  );

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      <div className="flex-1 relative min-h-0 bg-black overflow-hidden">
        <VideoTile
          stream={localStream}
          spotlight={spotlight === "local"}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          muted
          mirror={facingMode === "user"}
          fit="cover"
          label="You"
          pipCorner="right"
          pipIndex={0}
          onPromote={() => promote("local")}
        />

        {connected && (
          <VideoTile
            stream={remoteStream}
            spotlight={spotlight === "remote"}
            videoEnabled={remoteVideoEnabled}
            audioEnabled={remoteAudioEnabled}
            muted={false}
            fit="cover"
            label="Guest"
            sinkId={speakerId}
            pipCorner="left"
            pipIndex={0}
            onPromote={() => promote("remote")}
          />
        )}

        {showScreen && (
          <VideoTile
            stream={remoteScreenStream}
            spotlight={spotlight === "screen"}
            videoEnabled
            audioEnabled
            muted={false}
            fit="contain"
            label="Screen"
            pipCorner="left"
            pipIndex={spotlight !== "remote" ? 1 : 0}
            onPromote={() => promote("screen")}
          />
        )}

        {connected && !remoteAudioEnabled && spotlight !== "local" && (
          <div className="absolute top-20 left-5 z-floating">
            <div className="bg-red-500/90 backdrop-blur-md text-white px-3 py-2 rounded-full flex items-center gap-2 shadow-lg">
              <MicOff className="w-4 h-4" />
              <span className="text-sm font-medium">Muted</span>
            </div>
          </div>
        )}

        {!connected && (
          <div className="absolute inset-x-0 top-0 z-tile flex justify-center pointer-events-none">
            <div className="flex flex-col gap-2 items-center mt-10 pointer-events-auto">
              <div className="flex gap-2 items-center">
                <Spinner variant="ring" className="w-8 h-8 text-primary" />
                <p className="text-sm text-white/80">
                  {peerLeft
                    ? "They left — waiting for someone to join"
                    : "Waiting for someone to join"}
                </p>
              </div>
              <p className="text-xs text-white/50">Room {roomId}</p>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="mt-1 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                Copy link
              </button>
            </div>
          </div>
        )}

        {reconnecting && <CallBanner tone="warn">Reconnecting…</CallBanner>}
        {!signalingConnected && connected && (
          <CallBanner tone="danger">Signaling server disconnected</CallBanner>
        )}
        {connected && poorNetwork && !reconnecting && (
          <CallBanner tone="warn">Unstable network</CallBanner>
        )}
        {localScreenSharing && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-floating flex items-center gap-2 bg-blue-600/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm shadow-lg">
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
        {screenError && <CallBanner tone="danger">{screenError}</CallBanner>}

        <TopBar>
          <div className="flex gap-2 min-w-0">
            {connected && (
              <ConnectionStats
                stats={stats}
                showStats={showStats}
                onToggle={setShowStats}
              />
            )}
            <TopBarButton
              onClick={() => void copyLink()}
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
            {canSwitchCamera && (
              <TopBarButton
                onClick={() => void switchCamera()}
                Icon={SwitchCamera}
                title="Switch camera"
              />
            )}
          </div>
        </TopBar>

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

      <ReactionOverlay reactions={collab.callReactions} />

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
        onToggleReactions={toggleReactions}
        onReact={sendReaction}
        onLeave={onLeave}
      />
    </div>
  );
}
