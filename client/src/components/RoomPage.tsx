import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVideoCall } from "../hooks/useVideoCall";
import { usePreventRefresh } from "../hooks/usePreventRefresh";
import { Lobby } from "./Lobby";
import { CallScreen } from "./CallScreen";
import { ErrorToast } from "./CallBanner";
import { normalizeRoomId } from "../utils/helper";

export function RoomPage() {
  const { roomId: rawId = "" } = useParams();
  const roomId = normalizeRoomId(rawId);
  const navigate = useNavigate();
  const call = useVideoCall();
  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  usePreventRefresh(inCall);

  useEffect(() => {
    if (!roomId) {
      navigate("/", { replace: true });
      return;
    }
    void call.initializeMedia().catch(() => {
      // Lobby shows mediaError.
    });
    return () => {
      call.leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toast = joinError || call.roomError || call.collab.collabError;
  const showCall = inCall && !call.roomError;

  const handleJoin = async () => {
    setJoining(true);
    setJoinError(null);
    try {
      await call.joinCall(roomId);
      setInCall(true);
    } catch (error) {
      setJoinError(
        error instanceof Error
          ? error.message
          : "Could not join. Check camera permissions.",
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    call.leaveCall();
    setInCall(false);
    navigate("/");
  };

  return (
    <>
      {showCall ? (
        <CallScreen roomId={roomId} call={call} onLeave={handleLeave} />
      ) : (
        <Lobby
          roomId={roomId}
          stream={call.localStream}
          mediaError={call.mediaError}
          devices={call.devices}
          cameraId={call.cameraId}
          micId={call.micId}
          speakerId={call.speakerId}
          audioEnabled={call.audioEnabled}
          videoEnabled={call.videoEnabled}
          onToggleAudio={() => void call.toggleAudio()}
          onToggleVideo={() => void call.toggleVideo()}
          onSelectCamera={(id) => void call.selectCamera(id)}
          onSelectMic={(id) => void call.selectMic(id)}
          onSelectSpeaker={call.selectSpeaker}
          onRetryMedia={() => void call.initializeMedia()}
          onJoin={() => void handleJoin()}
          joining={joining}
        />
      )}
      {toast && (
        <ErrorToast
          message={toast}
          onDismiss={() => {
            setJoinError(null);
            if (call.roomError) setInCall(false);
            call.clearRoomError();
            call.collab.clearCollabError();
          }}
        />
      )}
    </>
  );
}
