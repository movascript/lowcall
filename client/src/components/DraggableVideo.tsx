// src/components/DraggableVideo.tsx
import { useEffect, useRef, useState } from "react";
import { CameraOff, MicOff } from "lucide-react";
import { cn } from "../utils/classname";

interface DraggableVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoEnabled: boolean;
  audioEnabled: boolean;
  connected: boolean;
}

export function DraggableVideo({
  videoRef,
  videoEnabled,
  audioEnabled,
  connected,
}: DraggableVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);

  const PADDING = 20;

  // Helper function to get constrained position
  const getConstrainedPosition = (x: number, y: number) => {
    if (!containerRef.current) return { x, y };

    const parent = containerRef.current.parentElement;
    if (!parent) return { x, y };

    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;

    const maxX = parentWidth - containerWidth - PADDING;
    const maxY = parentHeight - containerHeight - PADDING;

    return {
      x: Math.max(PADDING, Math.min(x, maxX)),
      y: Math.max(PADDING, Math.min(y, maxY)),
    };
  };

  // Initialize position to bottom-right when connected
  useEffect(() => {
    if (connected && !initialized && containerRef.current) {
      // Wait for CSS transition to complete (500ms) plus buffer
      const timer = setTimeout(() => {
        if (!containerRef.current) return;

        const parent = containerRef.current.parentElement;
        if (parent) {
          const parentWidth = parent.clientWidth;
          const parentHeight = parent.clientHeight;
          const containerWidth = containerRef.current.offsetWidth;
          const containerHeight = containerRef.current.offsetHeight;

          const newPosition = {
            x: parentWidth - containerWidth - PADDING,
            y: parentHeight - containerHeight - PADDING,
          };

          setPosition(getConstrainedPosition(newPosition.x, newPosition.y));
          setInitialized(true);
        }
      }, 550); // Match CSS transition duration (500ms) + 50ms buffer

      return () => clearTimeout(timer);
    } else if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialized(false);
      setPosition({ x: 0, y: 0 }); // Reset position when disconnected
    }
  }, [connected, initialized]);

  // Handle window resize
  useEffect(() => {
    if (!connected || !initialized) return;

    const handleResize = () => {
      setPosition((prev) => getConstrainedPosition(prev.x, prev.y));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [connected, initialized]);

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

      const newX = clientX - parentRect.left - dragOffset.x;
      const newY = clientY - parentRect.top - dragOffset.y;

      setPosition(getConstrainedPosition(newX, newY));
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
        "absolute rounded-2xl overflow-hidden shadow-2xl transition-all duration-400 ease-out z-20",
        connected
          ? "w-30 sm:w-40 md:w-55 lg:w-72 cursor-grab"
          : "w-[85%] max-w-xl max-h-7/10 top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2",

        isDragging && "cursor-grabbing scale-105 transition-none",
      )}
      style={
        connected && initialized
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: "none",
            }
          : connected
            ? {
                // Temporarily keep centered during initialization
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
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
      {!audioEnabled && connected && (
        <div className="absolute top-2 right-2 bg-gray-800/20 backdrop-blur-sm rounded-full p-1.5">
          <MicOff className="text-white size-3 md:size-4" />
        </div>
      )}
      {connected && (
        <div className="absolute inset-0 border-2 border-white/20 rounded-2xl pointer-events-none" />
      )}
    </div>
  );
}
