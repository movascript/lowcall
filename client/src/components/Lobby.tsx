import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Copy,
  Check,
  Mic,
  Video,
  ChevronDown,
  SwitchCamera,
} from "lucide-react";
import { DeviceSelect } from "./DeviceSelect";
import { cn } from "../utils/classname";
import {
  friendlyCameraLabel,
  preferredCameras,
  roomUrl,
} from "../utils/helper";
import type { MediaDeviceLists } from "../types";
import { Spinner } from "../ui/Spinner";

interface LobbyProps {
  roomId: string;
  stream: MediaStream | null;
  mediaError: string | null;
  devices: MediaDeviceLists;
  cameraId: string;
  micId: string;
  speakerId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  facingMode: "user" | "environment";
  canSwitchCamera: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onSelectCamera: (id: string) => void;
  onSelectMic: (id: string) => void;
  onSelectSpeaker: (id: string) => void;
  onRetryMedia: () => void;
  onJoin: () => void;
  joining: boolean;
}

export function Lobby({
  roomId,
  stream,
  mediaError,
  devices,
  cameraId,
  micId,
  speakerId,
  audioEnabled,
  videoEnabled,
  facingMode,
  canSwitchCamera,
  onToggleAudio,
  onToggleVideo,
  onSwitchCamera,
  onSelectCamera,
  onSelectMic,
  onSelectSpeaker,
  onRetryMedia,
  onJoin,
  joining,
}: LobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(roomId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const cameras = preferredCameras(devices.cameras, cameraId);

  return (
    <div className="h-full overflow-y-auto overscroll-contain p-4 sm:p-6">
      <div className="min-h-full flex flex-col justify-start sm:justify-center">
        <div className="bg-card/90 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full mx-auto animate-in fade-in-50 border border-white/40 overflow-x-hidden">
        <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Ready to join</p>
            <h1 className="text-xl font-bold text-foreground truncate">
              Room {roomId}
            </h1>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-full bg-secondary hover:bg-muted shrink-0"
            aria-label="Copy room link"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="relative aspect-video max-sm:aspect-3/4 rounded-3xl overflow-hidden isolate contain-[paint] bg-black mb-4 ring-1 ring-black/5 [clip-path:inset(0_round_1.5rem)]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover",
              facingMode === "user" && "-scale-x-100",
              !videoEnabled && "opacity-0",
            )}
          />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              Camera off
            </div>
          )}
          {canSwitchCamera && videoEnabled && !mediaError && (
            <button
              type="button"
              onClick={onSwitchCamera}
              aria-label="Switch camera"
              className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70"
            >
              <SwitchCamera size={18} />
            </button>
          )}
          {mediaError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white p-4 text-center">
              <p className="text-sm">{mediaError}</p>
              <button
                type="button"
                onClick={onRetryMedia}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-2 mb-4">
          <button
            type="button"
            aria-label={audioEnabled ? "Mute" : "Unmute"}
            onClick={onToggleAudio}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              audioEnabled ? "bg-secondary" : "bg-destructive text-white",
            )}
          >
            <Mic size={18} />
          </button>
          <button
            type="button"
            aria-label={videoEnabled ? "Camera off" : "Camera on"}
            onClick={onToggleVideo}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              videoEnabled ? "bg-secondary" : "bg-destructive text-white",
            )}
          >
            <Video size={18} />
          </button>
        </div>

        <details className="group mb-5 rounded-2xl border border-border/70 bg-secondary/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground select-none [&::-webkit-details-marker]:hidden">
            Camera, mic & speaker
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <DeviceSelect
              id="camera"
              label="Camera"
              value={cameraId}
              options={cameras}
              onChange={onSelectCamera}
              getLabel={friendlyCameraLabel}
            />
            <DeviceSelect
              id="mic"
              label="Microphone"
              value={micId}
              options={devices.mics}
              onChange={onSelectMic}
            />
            {devices.speakers.length > 0 && (
              <DeviceSelect
                id="speaker"
                label="Speaker"
                value={speakerId}
                options={devices.speakers}
                onChange={onSelectSpeaker}
              />
            )}
          </div>
        </details>

        <button
          type="button"
          onClick={onJoin}
          disabled={joining || Boolean(mediaError)}
          className="flex justify-center items-center gap-2 w-full py-3.5 text-base font-semibold text-primary-foreground bg-linear-to-r from-primary to-accent rounded-2xl disabled:opacity-50"
        >
          {joining ? (
            <Spinner variant="circle" className="w-5 h-5" />
          ) : (
            <>
              Join call
              <ArrowRight className="size-5" />
            </>
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
