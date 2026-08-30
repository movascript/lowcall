import { BITRATE, FALLBACK_ICE, signalingServer } from "./constants";

export async function fetchIceServers(): Promise<RTCConfiguration> {
  try {
    const res = await fetch(`${signalingServer}/ice`);
    if (!res.ok) return FALLBACK_ICE;
    const data = (await res.json()) as RTCConfiguration;
    if (!data.iceServers?.length) return FALLBACK_ICE;
    return {
      iceServers: data.iceServers,
      iceCandidatePoolSize: data.iceCandidatePoolSize ?? 2,
      bundlePolicy: data.bundlePolicy ?? "max-bundle",
      iceTransportPolicy: data.iceTransportPolicy ?? "all",
    };
  } catch {
    return FALLBACK_ICE;
  }
}

function sortCodecs<T extends { mimeType: string }>(
  codecs: T[],
  prefs: string[],
): T[] {
  return [...codecs].sort((a, b) => {
    const ai = prefs.findIndex(
      (p) => a.mimeType.toLowerCase() === p.toLowerCase(),
    );
    const bi = prefs.findIndex(
      (p) => b.mimeType.toLowerCase() === p.toLowerCase(),
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function preferCodecs(pc: RTCPeerConnection) {
  try {
    const videoPrefs = ["video/AV1", "video/VP9", "video/VP8", "video/H264"];
    const audioPrefs = ["audio/opus"];

    for (const trans of pc.getTransceivers()) {
      const kind = trans.receiver.track?.kind ?? trans.sender.track?.kind;
      if (kind === "video") {
        const caps = RTCRtpReceiver.getCapabilities("video");
        if (caps?.codecs.length) {
          trans.setCodecPreferences(sortCodecs(caps.codecs, videoPrefs));
        }
      }
      if (kind === "audio") {
        const caps = RTCRtpReceiver.getCapabilities("audio");
        if (caps?.codecs.length) {
          trans.setCodecPreferences(sortCodecs(caps.codecs, audioPrefs));
        }
      }
    }
  } catch {
    // Codec preference is best-effort; negotiation still proceeds.
  }
}

export async function applySenderParams(
  sender: RTCRtpSender,
  maxBitrate: number,
  degradation: RTCRtpSendParameters["degradationPreference"] = "maintain-framerate",
) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{ maxBitrate }];
    } else {
      params.encodings = params.encodings.map((e) => ({ ...e, maxBitrate }));
    }
    params.degradationPreference = degradation;
    await sender.setParameters(params);
  } catch {
    // Some browsers reject setParameters before negotiation completes.
  }
}

export function bitrateForTrack(
  track: MediaStreamTrack,
  hdEnabled: boolean,
): number {
  if (track.kind === "audio") return BITRATE.audio;
  if (track.contentHint === "detail") return BITRATE.screen;
  const height = track.getSettings().height ?? 0;
  if (height >= 720) return BITRATE.videoHd;
  if (height > 0) return BITRATE.videoSd;
  return hdEnabled ? BITRATE.videoHd : BITRATE.videoSd;
}
