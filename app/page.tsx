"use client";

import { useState, useEffect, useRef } from "react";
import CampfireCanvas from "./components/CampfireCanvas";
import PostModal from "./components/PostModal";

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [fuel, setFuel] = useState(0);
  const [level, setLevel] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("iv_session");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("iv_session", id); }
    setSessionId(id);
    setFuel(parseInt(localStorage.getItem("iv_fuel") || "0"));
    setLevel(parseInt(localStorage.getItem("iv_level") || "1"));

    const audio = new Audio("/music/chill_bgm01.mp3");
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;

    return () => { audio.pause(); };
  }, []);

  const startMusic = () => {
    if (audioRef.current && !musicOn) {
      audioRef.current.play().catch(() => {});
      setMusicOn(true);
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (musicOn) {
      audioRef.current.pause();
      setMusicOn(false);
    } else {
      audioRef.current.play().catch(() => {});
      setMusicOn(true);
    }
  };

  const addFuel = () => {
    const next = fuel + 1;
    setFuel(next);
    localStorage.setItem("iv_fuel", String(next));
  };

  const threshold = level * 10;
  const canStoke = fuel >= threshold;

  const stokefire = () => {
    const nl = level + 1;
    setLevel(nl); setFuel(0);
    localStorage.setItem("iv_level", String(nl));
    localStorage.setItem("iv_fuel", "0");
  };

  return (
    <main style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
      <CampfireCanvas sessionId={sessionId} campLevel={level} onFuelCollected={addFuel} />

      {/* ステータス表示 */}
      <div style={{
        position: "absolute", top: 16, left: 16,
        fontFamily: "monospace", fontSize: "12px", color: "#ffcc88",
        background: "rgba(0,0,0,0.5)", padding: "8px 12px",
        border: "1px solid #443300", lineHeight: "1.8",
      }}>
        <div>🔥 キャンプ Lv.{level}</div>
        <div style={{ color: "#bbbb88" }}>燃料 {fuel} / {threshold}</div>
        <div style={{ marginTop: 6, background: "#111100", height: 4, width: 100 }}>
          <div style={{ height: 4, width: `${Math.min(100, (fuel / threshold) * 100)}%`, background: "#ff8800" }} />
        </div>
      </div>

      {/* 音楽ボタン */}
      <button
        onClick={toggleMusic}
        title={musicOn ? "音楽をオフ" : "音楽をオン"}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(0,0,0,0.5)", border: "1px solid #443300",
          color: musicOn ? "#ffcc88" : "#665544",
          fontFamily: "monospace", fontSize: "16px",
          width: 36, height: 36, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {musicOn ? "♪" : "♩"}
      </button>

      {/* 火をくべるボタン */}
      {canStoke && (
        <button
          onClick={stokefire}
          style={{
            position: "absolute", bottom: 80, right: 20,
            background: "#881100", border: "2px solid #ff4400",
            color: "#ffffff", fontFamily: "monospace", fontSize: "13px",
            padding: "8px 16px", cursor: "pointer",
            animation: "pulse 1s infinite",
          }}
        >
          🔥 火をくべる！
        </button>
      )}

      {/* つぶやくボタン */}
      <button
        onClick={() => { startMusic(); setShowModal(true); }}
        style={{
          position: "absolute", bottom: 20, right: 20,
          background: "#553300", border: "2px solid #cc6600",
          color: "#ffcc88", fontFamily: "monospace", fontSize: "14px",
          padding: "10px 20px", cursor: "pointer",
        }}
      >
        ＋ つぶやく
      </button>

      {/* 操作ヒント */}
      <div style={{
        position: "absolute", bottom: 20, left: 16,
        fontFamily: "monospace", fontSize: "11px", color: "#665544",
      }}>
        吹き出しを長押し → 燃料収集
      </div>

      {showModal && <PostModal sessionId={sessionId} onClose={() => setShowModal(false)} />}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
    </main>
  );
}
