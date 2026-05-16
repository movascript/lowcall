// src/hooks/useVideoCall.ts
import { useWebRTC } from "./useWebRTC";
import { useMediaControls } from "./useMediaControls";
import { useCallTimer } from "./useCallTimer";
import { iceServers, signalingServer } from "../utils/constants";

export const useVideoCall = () => {
  const {
    connected,
    stats,
    remoteStream,
    remoteAudioEnabled,
    remoteVideoEnabled,
    setLocalStream,
    joinRoom: webrtcJoinRoom,
    leaveRoom: webrtcLeaveRoom,
    notifyPeerAudioToggle,
    notifyPeerVideoToggle,
    replaceVideoTrack,
  } = useWebRTC(signalingServer, iceServers);

  const {
    stream: localStream,
    audioEnabled,
    videoEnabled,
    hdEnabled,
    canSwitchCamera,
    initializeMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
  } = useMediaControls({
    onAudioToggle: notifyPeerAudioToggle,
    onVideoToggle: notifyPeerVideoToggle,
    onCameraSwitch: async (newTrack) => {
      if (connected) {
        await replaceVideoTrack(newTrack);
      }
    },
  });

  const callDuration = useCallTimer(connected);

  const joinRoom = async (roomId: string) => {
    try {
      const stream = await initializeMedia();
      setLocalStream(stream);
      webrtcJoinRoom(roomId, stream);
      return stream;
    } catch (error) {
      console.error("Error joining room:", error);
      throw error;
    }
  };

  const leaveRoom = () => {
    webrtcLeaveRoom();
    stopMedia();
  };

  const handleSwitchCamera = async () => {
    await switchCamera();
  };

  const handleToggleHD = async () => {
    await toggleHD();
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
    hdEnabled,
    canSwitchCamera,
    toggleAudio,
    toggleVideo,
    toggleHD: handleToggleHD,
    switchCamera: handleSwitchCamera,

    // Remote state
    remoteAudioEnabled,
    remoteVideoEnabled,

    // Room management
    joinRoom,
    leaveRoom,
  };
};
