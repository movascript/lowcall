import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, MicOff } from "lucide-react";
import { cn } from "../utils/classname";

export type VideoTileId = "local" | "remote" | "screen";

interface VideoTileProps {
  stream: MediaStream | null;
  spotlight: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  muted: boolean;
  mirror?: boolean;
  fit: "cover" | "contain";
  label?: string;
  sinkId?: string;
  pipCorner?: "left" | "right";
  pipIndex?: number;
  onPromote?: () => void;
}

export const VideoTile = memo(function VideoTile({
  stream,
  spotlight,
  videoEnabled,
  audioEnabled,
  muted,
  mirror,
  fit,
  label,
  sinkId,
  pipCorner = "right",
  pipIndex = 0,
  onPromote,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [placed, setPlaced] = useState(false);
  const drag = useRef({
    active: false,
    moved: false,
    ox: 0,
    oy: 0,
    startX: 0,
    startY: 0,
  });

  const PADDING = 16;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const el = videoRef.current as
      | (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (el?.setSinkId && sinkId) void el.setSinkId(sinkId);
  }, [sinkId, stream]);

  const constrain = useCallback((x: number, y: number) => {
    const node = containerRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return { x, y };
    const maxX = parent.clientWidth - node.offsetWidth - PADDING;
    const maxY = parent.clientHeight - node.offsetHeight - PADDING;
    return {
      x: Math.max(PADDING, Math.min(x, maxX)),
      y: Math.max(PADDING, Math.min(y, maxY)),
    };
  }, []);

  useEffect(() => {
    if (spotlight) {
      setPlaced(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const node = containerRef.current;
      const parent = node?.parentElement;
      if (!node || !parent) return;
      const x =
        pipCorner === "right"
          ? parent.clientWidth - node.offsetWidth - PADDING
          : PADDING;
      const y =
        parent.clientHeight -
        node.offsetHeight -
        PADDING -
        pipIndex * (node.offsetHeight + 12);
      setPosition(constrain(x, y));
      setPlaced(true);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [spotlight, pipCorner, pipIndex, constrain]);

  useEffect(() => {
    if (spotlight || !placed) return;
    const onResize = () => setPosition((prev) => constrain(prev.x, prev.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [spotlight, placed, constrain]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (clientX: number, clientY: number) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dx = clientX - drag.current.startX;
      const dy = clientY - drag.current.startY;
      if (Math.hypot(dx, dy) > 8) drag.current.moved = true;
      setPosition(
        constrain(
          clientX - rect.left - drag.current.ox,
          clientY - rect.top - drag.current.oy,
        ),
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    };
    const onEnd = () => {
      if (!drag.current.moved) onPromote?.();
      drag.current.active = false;
      setDragging(false);
    };

    document.addEventListener("mousemove", onMouseMove, { passive: false });
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [dragging, constrain, onPromote]);

  const startDrag = (clientX: number, clientY: number) => {
    if (spotlight || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    drag.current = {
      active: true,
      moved: false,
      ox: clientX - rect.left,
      oy: clientY - rect.top,
      startX: clientX,
      startY: clientY,
    };
    setDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden bg-black isolate [contain:paint]",
        spotlight
          ? "absolute inset-0 z-video rounded-none"
          : cn(
              "absolute z-tile aspect-video w-28 sm:w-40 md:w-52 lg:w-64 rounded-2xl shadow-2xl ring-1 ring-white/20 cursor-grab",
              dragging && "cursor-grabbing scale-[1.03] shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
            ),
      )}
      style={
        spotlight
          ? undefined
          : placed
            ? { left: position.x, top: position.y }
            : {
                right: pipCorner === "right" ? PADDING : "auto",
                left: pipCorner === "left" ? PADDING : "auto",
                bottom: PADDING + pipIndex * 120,
              }
      }
      onMouseDown={
        spotlight
          ? undefined
          : (e) => {
              e.preventDefault();
              startDrag(e.clientX, e.clientY);
            }
      }
      onTouchStart={
        spotlight
          ? undefined
          : (e) => {
              const t = e.touches[0];
              startDrag(t.clientX, t.clientY);
            }
      }
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[inherit] [transform:translateZ(0)]"
        style={{
          clipPath: spotlight ? "inset(0)" : "inset(0 round 1rem)",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          disablePictureInPicture
          disableRemotePlayback
          className={cn(
            "h-full w-full",
            fit === "contain" ? "object-contain" : "object-cover",
            mirror && "-scale-x-100",
          )}
        />
      </div>
      {!videoEnabled && (
        <div className="absolute inset-0 bg-zinc-900/95 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
          <CameraOff
            size={spotlight ? 48 : 22}
            className="text-white/50"
          />
          {spotlight && (
            <span className="text-white/60 text-sm">Camera off</span>
          )}
        </div>
      )}
      {!audioEnabled && (
        <div className="absolute top-2 right-2 rounded-full bg-black/50 backdrop-blur-md p-1.5">
          <MicOff className={spotlight ? "size-4 text-white" : "size-3 text-white"} />
        </div>
      )}
      {!spotlight && label && (
        <div className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white/90 px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-md">
          {label}
        </div>
      )}
    </div>
  );
});
