import { useEffect, useRef, useState } from "react";
import { ArrowRight, Copy, Check, Mic, Video } from "lucide-react";
import { DeviceSelect } from "./DeviceSelect";
import { cn } from "../utils/classname";
import { roomUrl } from "../utils/helper";
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
  onToggleAudio: () => void;
  onToggleVideo: () => void;
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
  onToggleAudio,
  onToggleVideo,
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
    if (videoRef.current) videoRef.current.srcObject = stream;
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

  return (
    <div className="flex items-center justify-center h-full p-4 sm:p-6 overflow-y-auto">
      <div className="bg-card/90 backdrop-blur-xl rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full animate-in fade-in-50 border border-white/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Ready to join</p>
            <h1 className="text-xl font-bold text-foreground">Room {roomId}</h1>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-full bg-secondary hover:bg-muted"
            aria-label="Copy room link"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="relative aspect-video rounded-3xl overflow-hidden bg-black mb-4 ring-1 ring-black/5">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover scale-x-[-1]",
              !videoEnabled && "opacity-0",
            )}
          />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              Camera off
            </div>
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

        <div className="space-y-3 mb-5">
          <DeviceSelect
            id="camera"
            label="Camera"
            value={cameraId}
            options={devices.cameras}
            onChange={onSelectCamera}
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
  );
}
