// src/components/DraggableVideo.tsx
import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { cn } from "../utils/classname";

interface DraggableVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoEnabled: boolean;
  connected: boolean;
}

export function DraggableVideo({
  videoRef,
  videoEnabled,
  connected,
}: DraggableVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  // Initialize position to bottom-right when connected
  useEffect(() => {
    if (connected && !initialized && containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const padding = 20;
        setPosition({
          x: parentRect.width - containerRect.width - padding,
          y: parentRect.height - containerRect.height - padding,
        });
        setInitialized(true);
      }
    } else if (!connected) {
      setInitialized(false);
    }
  }, [connected, initialized]);

  useEffect(() => {
    if (!connected) return;

    const handleResize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          const padding = 20;

          // Clamp position to stay within bounds
          setPosition((prev) => ({
            x: Math.min(
              prev.x,
              parentRect.width - containerRect.width - padding,
            ),
            y: Math.min(
              prev.y,
              parentRect.height - containerRect.height - padding,
            ),
          }));
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [connected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const parent = containerRef.current.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      const padding = 16;
      const maxX = parentRect.width - containerRect.width - padding;
      const maxY = parentRect.height - containerRect.height - padding;

      let newX = clientX - parentRect.left - dragOffset.x;
      let newY = clientY - parentRect.top - dragOffset.y;

      newX = Math.max(padding, Math.min(newX, maxX));
      newY = Math.max(padding, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ease-out z-20",
        connected
          ? "w-32 sm:w-44 md:w-55 lg:w-70 cursor-grab"
          : "w-[85%] max-w-xl max-h-7/10 top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2",

        isDragging && "cursor-grabbing scale-105 transition-none",
      )}
      style={
        connected
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: "none",
            }
          : undefined
      }
      onMouseDown={connected ? handleMouseDown : undefined}
      onTouchStart={connected ? handleTouchStart : undefined}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        className="w-full h-full object-cover scale-x-[-1]"
      />
      {!videoEnabled && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <CameraOff size={connected ? 30 : 50} className="text-gray-400" />
        </div>
      )}
      {connected && (
        <div className="absolute inset-0 border-2 border-white/20 rounded-2xl pointer-events-none" />
      )}
    </div>
  );
}
