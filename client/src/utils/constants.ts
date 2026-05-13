// utils/constants.ts

export const signalingServer = "https://lowcall.ir";

export const iceServers: RTCConfiguration = {
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
  iceCandidatePoolSize: 1,
  bundlePolicy: "max-bundle",
  iceTransportPolicy: "all",
  rtcpMuxPolicy: "require",
};
