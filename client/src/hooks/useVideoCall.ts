// src/hooks/useVideoCall.ts
import { useWebRTC } from "./useWebRTC";
import { useMediaControls } from "./useMediaControls";
import { useCallTimer } from "./useCallTimer";
import { iceServers, signalingServer } from "../utils/constants";

export const useVideoCall = () => {
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
    replaceVideoTrack,
  } = useWebRTC(signalingServer, iceServers);

  const {
    audioEnabled,
    videoEnabled,
    canSwitchCamera,
    toggleAudio,
    toggleVideo,
    switchCamera,
  } = useMediaControls(localStream, {
    onAudioToggle: notifyPeerAudioToggle,
    onVideoToggle: notifyPeerVideoToggle,
    onCameraSwitch: async (newTrack) => {
      if (connected) {
        await replaceVideoTrack(newTrack);
      }
    },
  });

  const callDuration = useCallTimer(connected);

  const handleSwitchCamera = async () => {
    await switchCamera();
  };

  return {
    // Connection state
    connected,
    stats,
    callDuration,

    // Streams
    localStream,
    remoteStream,

    // Local controls
    audioEnabled,
    videoEnabled,
    canSwitchCamera,
    toggleAudio,
    toggleVideo,
    switchCamera: handleSwitchCamera,

    // Remote state
    remoteAudioEnabled,
    remoteVideoEnabled,

    // Room management
    joinRoom,
    leaveRoom,
  };
};
