// src/hooks/useVideoCall.ts
import { useWebRTC } from "./useWebRTC";
import { useMediaControls } from "./useMediaControls";
import { iceServers, signalingServer } from "../utils/constants";
import { useEffect } from "react";

export const useVideoCall = () => {
  const {
    connected,
    signalingConnected,
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
    replaceAudioTrack,
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
    facingMode,
    switchCamera,
    restartAudio,
    restartVideo,
  } = useMediaControls();

  useEffect(() => {
    if (connected && localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];

      if (audioTrack) {
        notifyPeerAudioToggle(audioTrack.enabled);
      }

      if (videoTrack) {
        notifyPeerVideoToggle(videoTrack.enabled);
      }
    }
  }, [connected]);

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

  const handleToggleAudio = async () => {
    const wasEnabled = audioEnabled;
    toggleAudio();

    if (wasEnabled) {
      // Disabling - track is already stopped in toggleAudio
      notifyPeerAudioToggle(false);
    } else {
      // Re-enabling - need to get new track
      const newTrack = await restartAudio();
      if (newTrack) {
        await replaceAudioTrack(newTrack);
        notifyPeerAudioToggle(true);
      }
    }
  };

  const handleToggleVideo = async () => {
    const wasEnabled = videoEnabled;
    toggleVideo();

    if (wasEnabled) {
      // Disabling - track is already stopped in toggleVideo
      notifyPeerVideoToggle(false);
    } else {
      // Re-enabling - need to get new track
      const newTrack = await restartVideo();
      if (newTrack) {
        await replaceVideoTrack(newTrack);
        notifyPeerVideoToggle(true);
      }
    }
  };

  const handleSwitchCamera = async () => {
    const newTrack = await switchCamera();
    if (newTrack == null) {
      alert("debug: why the heck the track is null");
      console.log("debug: why the heck the track is null");
      return;
    }
    await replaceVideoTrack(newTrack);
  };

  const handleToggleHD = async () => {
    const newTrack = await toggleHD();
    if (newTrack == null) {
      alert("debug: why the heck the track is null");
      console.log("debug: why the heck the track is null");
      return;
    }
    await replaceVideoTrack(newTrack);
  };

  return {
    // Connection state
    connected,
    signalingConnected,
    stats,

    // Streams
    localStream,
    remoteStream,

    // Local controls
    audioEnabled,
    videoEnabled,
    facingMode,
    hdEnabled,
    canSwitchCamera,
    toggleAudio: handleToggleAudio,
    toggleVideo: handleToggleVideo,
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
