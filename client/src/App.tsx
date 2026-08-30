import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import LandingPage from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";
import { normalizeRoomId, randomRoomId } from "./utils/helper";

function Home() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const go = (id: string) => {
    const next = normalizeRoomId(id);
    if (next) navigate(`/${next}`);
  };

  return (
    <div className="w-full h-dvh bg-linear-to-br from-primary via-primary to-accent overflow-hidden">
      <LandingPage
        roomId={roomId}
        setRoomId={setRoomId}
        onJoin={() => go(roomId)}
        onCreate={() => go(randomRoomId())}
      />
    </div>
  );
}

function App() {
  return (
    <div className="w-full h-dvh bg-linear-to-br from-primary via-primary to-accent overflow-hidden">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:roomId" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
