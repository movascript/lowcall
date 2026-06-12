// src/hooks/useVideoCall.ts
import { useEffect } from "react";
import { useSignaling } from "./useSignaling";
import { useWebRTC } from "./useWebRTC";
import { useMediaControls } from "./useMediaControls";
import { iceServers, signalingServer } from "../utils/constants";

export const useVideoCall = () => {
  const signaling = useSignaling(signalingServer);
  const webrtc = useWebRTC(signaling, iceServers);
  const media = useMediaControls();

  useEffect(() => {
    if (!webrtc.connected || !media.stream) return;
    const audio = media.stream.getAudioTracks()[0];
    const video = media.stream.getVideoTracks()[0];
    if (audio) webrtc.notifyPeerAudioToggle(audio.enabled);
    if (video) webrtc.notifyPeerVideoToggle(video.enabled);
  }, [webrtc.connected]);

  const joinRoom = async (roomId: string) => {
    const stream = await media.initializeMedia();
    webrtc.joinRoom(roomId, stream);
    return stream;
  };

  const leaveRoom = () => {
    webrtc.leaveRoom();
    media.stopMedia();
  };

  const toggleAudio = async () => {
    media.toggleAudio();
    if (media.audioEnabled) {
      webrtc.notifyPeerAudioToggle(false);
    } else {
      const track = await media.restartAudio();
      if (track) {
        await webrtc.replaceAudioTrack(track);
        webrtc.notifyPeerAudioToggle(true);
      }
    }
  };

  const toggleVideo = async () => {
    media.toggleVideo();
    if (media.videoEnabled) {
      webrtc.notifyPeerVideoToggle(false);
    } else {
      const track = await media.restartVideo();
      if (track) {
        await webrtc.replaceVideoTrack(track);
        webrtc.notifyPeerVideoToggle(true);
      }
    }
  };

  const switchCamera = async () => {
    const track = await media.switchCamera();
    if (track) await webrtc.replaceVideoTrack(track);
  };

  const toggleHD = async () => {
    const track = await media.toggleHD();
    if (track) await webrtc.replaceVideoTrack(track);
  };

  return {
    // Connection
    connected: webrtc.connected,
    signalingConnected: signaling.connected,
    stats: webrtc.stats,
    // Streams
    localStream: media.stream,
    remoteStream: webrtc.remoteStream,
    // Local state
    audioEnabled: media.audioEnabled,
    videoEnabled: media.videoEnabled,
    hdEnabled: media.hdEnabled,
    facingMode: media.facingMode,
    canSwitchCamera: media.canSwitchCamera,
    // Local controls
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
    // Remote state
    remoteAudioEnabled: webrtc.remoteAudioEnabled,
    remoteVideoEnabled: webrtc.remoteVideoEnabled,
    // Room
    joinRoom,
    leaveRoom,
  };
};
