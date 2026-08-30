export const signalingServer =
  import.meta.env.VITE_SIGNALING_URL ||
  (import.meta.env.DEV ? "" : "https://lowcall.ir");

export const BITRATE = {
  audio: 40_000,
  videoSd: 600_000,
  videoHd: 1_200_000,
  screen: 1_500_000,
} as const;

export const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:lowcall.ir:3478", "stun:stun3.l.google.com:3478"] },
    {
      urls: "turn:lowcall.ir:3478",
      username: "myuser",
      credential: "mypassword",
    },
    {
      urls: "turns:lowcall.ir:5349",
      username: "myuser",
      credential: "mypassword",
    },
  ],
  iceCandidatePoolSize: 2,
  bundlePolicy: "max-bundle",
  iceTransportPolicy: "all",
};

export const HD_VIDEO: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 20 },
};

export const SD_VIDEO: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 360 },
  frameRate: { ideal: 15 },
};

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const CHAT_MAX_LENGTH = 2000;
export const FILE_MAX_BYTES = 50 * 1024 * 1024;
export const FILE_CHUNK_SIZE = 16 * 1024;

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
