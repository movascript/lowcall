import { useEffect, useState } from "react";
import { useSignaling } from "./useSignaling";
import { useWebRTC } from "./useWebRTC";
import { useMediaControls } from "./useMediaControls";
import { usePeerData } from "./usePeerData";
import { signalingServer, FALLBACK_ICE } from "../utils/constants";
import { fetchIceServers } from "../utils/ice";

export const useVideoCall = () => {
  const [iceConfig, setIceConfig] = useState<RTCConfiguration>(FALLBACK_ICE);
  const signaling = useSignaling(signalingServer);
  const media = useMediaControls();
  const webrtc = useWebRTC(signaling, iceConfig, media.hdEnabled);
  const collab = usePeerData(
    webrtc.peerConnectionRef,
    webrtc.roleReady,
    webrtc.polite,
    webrtc.pcEpoch,
    webrtc.kickNegotiate,
  );

  useEffect(() => {
    void fetchIceServers().then(setIceConfig);
  }, []);

  useEffect(() => {
    webrtc.syncLocalStream(media.stream);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep peer connection's local tracks in sync after camera/mic swaps
  }, [media.stream]);

  useEffect(() => {
    if (!webrtc.connected || !media.stream) return;
    const audio = media.stream.getAudioTracks()[0];
    const video = media.stream.getVideoTracks()[0];
    if (audio) webrtc.notifyPeerAudioToggle(audio.enabled);
    if (video) webrtc.notifyPeerVideoToggle(video.enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.connected]);

  const joinCall = async (roomId: string) => {
    const stream = media.stream ?? (await media.initializeMedia());
    webrtc.joinRoom(roomId, stream);
  };

  const leaveCall = () => {
    webrtc.leaveRoom();
    media.stopMedia();
    collab.resetCollab();
  };

  const toggleAudio = async () => {
    const enabled = media.toggleAudio();
    const track = media.stream?.getAudioTracks()[0] ?? null;
    if (enabled && track) {
      await webrtc.replaceAudioTrack(track);
    } else {
      await webrtc.replaceAudioTrack(null);
    }
    webrtc.notifyPeerAudioToggle(enabled);
  };

  const toggleVideo = async () => {
    const enabled = media.toggleVideo();
    const track = media.stream?.getVideoTracks()[0] ?? null;
    if (enabled && track) {
      await webrtc.replaceVideoTrack(track);
    } else {
      await webrtc.replaceVideoTrack(null);
    }
    webrtc.notifyPeerVideoToggle(enabled);
  };

  const switchCamera = async () => {
    const track = await media.switchCamera();
    if (track) await webrtc.replaceVideoTrack(track);
  };

  const toggleHD = async () => {
    const track = await media.toggleHD();
    if (track) await webrtc.replaceVideoTrack(track);
  };

  const selectCamera = async (deviceId: string) => {
    const track = await media.selectCamera(deviceId);
    if (track) await webrtc.replaceVideoTrack(track);
  };

  const selectMic = async (deviceId: string) => {
    const track = await media.selectMic(deviceId);
    if (track) await webrtc.replaceAudioTrack(track);
  };

  return {
    signalingConnected: signaling.connected,
    connected: webrtc.connected,
    stats: webrtc.stats,
    iceState: webrtc.iceState,
    peerLeft: webrtc.peerLeft,
    roomError: webrtc.roomError,
    clearRoomError: webrtc.clearRoomError,
    localStream: media.stream,
    remoteStream: webrtc.remoteStream,
    remoteScreenStream: webrtc.remoteScreenStream,
    audioEnabled: media.audioEnabled,
    videoEnabled: media.videoEnabled,
    hdEnabled: media.hdEnabled,
    facingMode: media.facingMode,
    canSwitchCamera: media.canSwitchCamera,
    devices: media.devices,
    cameraId: media.cameraId,
    micId: media.micId,
    speakerId: media.speakerId,
    mediaError: media.mediaError,
    remoteAudioEnabled: webrtc.remoteAudioEnabled,
    remoteVideoEnabled: webrtc.remoteVideoEnabled,
    remoteScreenSharing: webrtc.remoteScreenSharing,
    localScreenSharing: webrtc.localScreenSharing,
    initializeMedia: media.initializeMedia,
    selectSpeaker: media.selectSpeaker,
    toggleAudio,
    toggleVideo,
    toggleHD,
    switchCamera,
    selectCamera,
    selectMic,
    startScreenShare: webrtc.startScreenShare,
    stopScreenShare: webrtc.stopScreenShare,
    joinCall,
    leaveCall,
    collab,
  };
};
