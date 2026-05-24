"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function PostModal({ sessionId, onClose }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    await supabase.from("posts").insert({ content: text.trim(), session_id: sessionId });
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        style={{
          background: "#111122",
          border: "2px solid #cc6600",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          margin: "0 16px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ color: "#ffaa44", marginBottom: "12px", fontSize: "14px" }}>
          ▶ InnerVoice をつぶやく
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          placeholder="今、心の声を吐き出そう..."
          autoFocus
          style={{
            width: "100%",
            height: "120px",
            background: "#0a0a18",
            color: "#ddddcc",
            border: "1px solid #444433",
            padding: "10px",
            fontFamily: "monospace",
            fontSize: "13px",
            resize: "none",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
          <span style={{ color: "#666655", fontSize: "12px" }}>{text.length} / 140</span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #444433",
                color: "#888877",
                padding: "6px 16px",
                fontFamily: "monospace",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              キャンセル
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() || submitting}
              style={{
                background: text.trim() && !submitting ? "#cc5500" : "#333322",
                border: "none",
                color: text.trim() && !submitting ? "#ffffff" : "#666655",
                padding: "6px 16px",
                fontFamily: "monospace",
                fontSize: "13px",
                cursor: text.trim() && !submitting ? "pointer" : "default",
              }}
            >
              {submitting ? "送信中..." : "流す →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
