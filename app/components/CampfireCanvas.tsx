"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── 型定義 ──────────────────────────────────────────────

interface Post { id: string; content: string; session_id: string }
interface Star { x: number; y: number; sz: number; phase: number }
type AnimalType = "cat" | "rabbit" | "bear";

interface Animal {
  id: string;
  postId: string;
  x: number;
  y: number;
  text: string;
  type: AnimalType;
  frame: number;
  frameTimer: number;
  speed: number;       // + = 右向き, - = 左向き
  opacity: number;
  fading: boolean;
  collecting: boolean;
  collectTimer: number;
}

interface BubbleRect { x: number; y: number; w: number; h: number }

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; colorIdx: number;
}

const SPARK_COLORS = ["#ff6600","#ff9900","#ffcc00","#ff4400","#ffee88","#ff7700"];

interface WindStreak {
  x: number; y: number;
  speed: number; length: number;
  opacity: number; maxOpacity: number;
  delay: number;
}

interface Props {
  sessionId: string;
  campLevel: number;
  onFuelCollected: () => void;
}

// ── ピクセルアートスケール ──────────────────────────────

const S = 3; // 1ドット = 3pxスケール

// スプライトの論理サイズ（ドット数）
const SPRITE_W: Record<AnimalType, number> = { cat: 16, rabbit: 12, bear: 14 };
const SPRITE_H: Record<AnimalType, number> = { cat: 13, rabbit: 15, bear: 15 };

// ── 描画関数（Reactの外に定義） ──────────────────────────

function drawFireGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number) {
  const f1 = Math.sin(frame * 0.07) * 0.15;
  const f2 = Math.sin(frame * 0.13 + 1.2) * 0.10;
  const f3 = Math.sin(frame * 0.04 + 2.5) * 0.08;
  const flicker = 0.65 + f1 + f2 + f3;

  const r = 220 + flicker * 40;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0,   `rgba(255,160, 40,${(flicker * 0.45).toFixed(2)})`);
  grad.addColorStop(0.3, `rgba(255, 90, 15,${(flicker * 0.20).toFixed(2)})`);
  grad.addColorStop(0.65,`rgba(180, 50,  5,${(flicker * 0.08).toFixed(2)})`);
  grad.addColorStop(1,   "rgba(0,0,0,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.restore();
}

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#050510");
  g.addColorStop(0.55, "#0d0820");
  g.addColorStop(0.78, "#0a1808");
  g.addColorStop(1, "#050f04");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], w: number, h: number, frame: number) {
  stars.forEach((s) => {
    const a = 0.3 + 0.7 * Math.abs(Math.sin(s.phase + frame * 0.025));
    const sx = (s.x * w) | 0;
    const sy = (s.y * h) | 0;
    const sz = s.sz | 0;

    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = "#ffffff";

    // 中心ドット
    ctx.fillRect(sx, sy, sz, sz);

    // 明るい星だけ十字スパークル
    if (s.sz > 2) {
      const arm = Math.max(1, (sz * 1.5 * Math.abs(Math.sin(s.phase + frame * 0.04))) | 0);
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(sx - arm, sy + (sz >> 1), arm * 2 + sz, 1);
      ctx.fillRect(sx + (sz >> 1), sy - arm, 1, arm * 2 + sz);
    }
    ctx.restore();
  });
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, gy: number) {
  ctx.fillStyle = "#060e06";
  ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = "#112011";
  ctx.fillRect(0, gy, w, 4);
  ctx.fillStyle = "#1a341a";
  for (let x = 0; x < w; x += 14) {
    if (Math.sin(x * 0.35) > 0.2) ctx.fillRect(x, gy - 4, 4, 5);
  }
}

function drawFire(ctx: CanvasRenderingContext2D, cx: number, gy: number, frame: number) {
  const f = Math.sin(frame * 0.38) * 5 + Math.cos(frame * 0.71) * 3;

  // 丸太
  ctx.fillStyle = "#3a2000"; ctx.fillRect(cx - 30, gy - 6, 60, 10);
  ctx.fillStyle = "#4e2c00";
  ctx.fillRect(cx - 22, gy - 10, 14, 10);
  ctx.fillRect(cx + 8,  gy - 10, 14, 10);

  // 炭火
  ctx.fillStyle = "#cc2200"; ctx.fillRect(cx - 14, gy - 10, 28, 10);

  // 炎・外側（赤）
  ctx.fillStyle = "#aa1800"; ctx.fillRect(cx - 18, gy - 26, 36, 26);

  // 炎・中間（オレンジ）
  ctx.fillStyle = "#ee5500";
  ctx.fillRect(cx - 12, gy - 36 + f, 24, 28);
  ctx.fillRect(cx - 16, gy - 22, 7, 16);
  ctx.fillRect(cx + 9,  gy - 22 + f * 0.6, 7, 16);

  // 炎・内側（黄）
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(cx - 7,  gy - 46 + f, 14, 22);
  ctx.fillRect(cx - 12, gy - 30 + f, 6, 12);
  ctx.fillRect(cx + 6,  gy - 30 + f * 0.8, 6, 12);

  // 先端（白黄）
  ctx.fillStyle = "#ffffaa"; ctx.fillRect(cx - 3, gy - 54 + f, 6, 12);

  // 火花
  if (frame % 6 === 0) {
    ctx.fillStyle = "#ffaa44";
    for (let i = 0; i < 2; i++) {
      ctx.fillRect(
        (cx + Math.random() * 32 - 16) | 0,
        (gy - 58 - Math.random() * 14) | 0,
        2, 2
      );
    }
  }
}

function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, fr: number) {
  const s = S;
  ctx.save(); ctx.translate(x, y);
  const [b, d, k, p] = ["#C8A47A", "#7A5430", "#111111", "#FFB0C0"];
  ctx.fillStyle = b;
  ctx.fillRect(1*s,0,2*s,3*s); ctx.fillRect(7*s,0,2*s,3*s); // 耳
  ctx.fillRect(0,2*s,10*s,5*s); // 頭
  ctx.fillStyle = k;
  ctx.fillRect(2*s,3*s,s,s); ctx.fillRect(7*s,3*s,s,s); // 目
  ctx.fillStyle = p; ctx.fillRect(4*s,4*s,2*s,s); // 鼻
  ctx.fillStyle = b;
  ctx.fillRect(1*s,6*s,10*s,5*s); // 胴
  ctx.fillRect(11*s,6*s,4*s,2*s); ctx.fillRect(14*s,4*s,2*s,2*s); // しっぽ
  ctx.fillStyle = d;
  if (fr === 0) { ctx.fillRect(2*s,10*s,2*s,3*s); ctx.fillRect(7*s,10*s,2*s,3*s); }
  else          { ctx.fillRect(2*s,10*s,2*s,2*s); ctx.fillRect(3*s,11*s,2*s,2*s); ctx.fillRect(6*s,10*s,2*s,2*s); ctx.fillRect(8*s,11*s,2*s,2*s); }
  ctx.restore();
}

function drawRabbit(ctx: CanvasRenderingContext2D, x: number, y: number, fr: number) {
  const s = S;
  ctx.save(); ctx.translate(x, y);
  const [w, g, p] = ["#D8D8D8", "#A0A0A0", "#FFB0B0"];
  ctx.fillStyle = w;
  ctx.fillRect(3*s,0,2*s,7*s); ctx.fillRect(7*s,0,2*s,7*s); // 耳
  ctx.fillStyle = p;
  ctx.fillRect(3*s,0,s,6*s); ctx.fillRect(7*s,0,s,6*s); // 耳内
  ctx.fillStyle = w;
  ctx.fillRect(1*s,4*s,10*s,5*s); // 頭
  ctx.fillStyle = p;
  ctx.fillRect(2*s,5*s,s,s); ctx.fillRect(9*s,5*s,s,s); // 目
  ctx.fillRect(5*s,7*s,2*s,s); // 鼻
  ctx.fillStyle = w;
  ctx.fillRect(0,8*s,12*s,6*s); // 胴
  ctx.fillRect(-2*s,9*s,3*s,3*s); // しっぽ
  ctx.fillStyle = g;
  if (fr === 0) { ctx.fillRect(1*s,13*s,4*s,2*s); ctx.fillRect(7*s,13*s,4*s,2*s); }
  else          { ctx.fillRect(0,13*s,4*s,2*s); ctx.fillRect(8*s,13*s,4*s,2*s); }
  ctx.restore();
}

function drawBear(ctx: CanvasRenderingContext2D, x: number, y: number, fr: number) {
  const s = S;
  ctx.save(); ctx.translate(x, y);
  const [b, l, d, k] = ["#8B6347", "#C4A07A", "#5C3D20", "#111111"];
  ctx.fillStyle = b;
  ctx.fillRect(0,0,3*s,3*s); ctx.fillRect(11*s,0,3*s,3*s); // 耳
  ctx.fillStyle = l;
  ctx.fillRect(s,0,s,2*s); ctx.fillRect(12*s,0,s,2*s); // 耳内
  ctx.fillStyle = b; ctx.fillRect(0,2*s,14*s,6*s); // 頭
  ctx.fillStyle = l; ctx.fillRect(3*s,5*s,7*s,3*s); // 口元
  ctx.fillStyle = k;
  ctx.fillRect(2*s,3*s,s,s); ctx.fillRect(11*s,3*s,s,s); // 目
  ctx.fillRect(6*s,5*s,2*s,2*s); // 鼻
  ctx.fillStyle = b; ctx.fillRect(1*s,7*s,12*s,6*s); // 胴
  ctx.fillStyle = d;
  if (fr === 0) { ctx.fillRect(2*s,12*s,3*s,3*s); ctx.fillRect(9*s,12*s,3*s,3*s); }
  else          { ctx.fillRect(s,12*s,3*s,3*s); ctx.fillRect(10*s,12*s,3*s,3*s); }
  ctx.restore();
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  text: string,
  alpha: number
): BubbleRect {
  const fontSize = 12;
  const lh = 18;
  const px = 10, py = 8;
  ctx.font = `${fontSize}px monospace`;

  // テキスト折り返し
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > 170) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);

  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bw = Math.max(80, maxW + px * 2);
  const bh = lines.length * lh + py * 2;
  const bx = (cx - bw / 2) | 0;
  const by = (top - bh - 14) | 0;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 吹き出し本体
  ctx.fillStyle = "#ffffee";
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = "#888866";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  // しっぽ（三角形）
  const tx = (cx - 5) | 0;
  ctx.fillStyle = "#ffffee";
  ctx.fillRect(tx, by + bh, 10, 8);
  ctx.fillRect(tx + 1, by + bh - 1, 8, 2); // 上境界を消す
  ctx.strokeStyle = "#888866";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(tx, by + bh); ctx.lineTo(tx, by + bh + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx + 10, by + bh); ctx.lineTo(tx + 10, by + bh + 8); ctx.stroke();

  // テキスト
  ctx.fillStyle = "#333322";
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, bx + px, by + py + i * lh));

  ctx.restore();
  return { x: bx, y: by, w: bw, h: bh + 8 };
}

// ── Reactコンポーネント ──────────────────────────────────

export default function CampfireCanvas({ sessionId, campLevel, onFuelCollected }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef  = useRef<Star[]>([]);
  const animalsRef = useRef<Animal[]>([]);
  const queueRef  = useRef<Post[]>([]);
  const seenRef   = useRef<Set<string>>(new Set());
  const frameRef  = useRef(0);
  const bubbleRef = useRef<Map<string, BubbleRect>>(new Map());
  const bgImageRef   = useRef<HTMLImageElement | null>(null);
  const sparksRef    = useRef<Spark[]>([]);
  const windRef      = useRef<WindStreak[]>([]);
  const nextGustRef  = useRef<number>(3000);

  // 背景画像を読み込む
  useEffect(() => {
    const img = new Image();
    img.src = "/images/bg.png";
    img.onload = () => { bgImageRef.current = img; };
  }, []);

  // 星を初期化
  useEffect(() => {
    starsRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random() * 0.30,
      sz: Math.random() * 3 + 2,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  // 既読をローカルストレージから復元
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("iv_seen") || "[]");
      seenRef.current = new Set(arr);
    } catch { /* ignore */ }
  }, []);

  // Supabaseから投稿を取得 & リアルタイム購読
  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,content,session_id")
        .gt("expires_at", new Date().toISOString())
        .neq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) {
        queueRef.current.push(...data.filter((p) => !seenRef.current.has(p.id)));
      }
    };
    load();

    const ch = supabase
      .channel("iv-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const p = payload.new as Post;
        if (p.session_id !== sessionId && !seenRef.current.has(p.id)) queueRef.current.push(p);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // アニメーションループ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    let raf: number;
    let lastSpawn = 0;
    const GROUND = 0.8;
    const SPAWN_MS = 5000;
    const TYPES: AnimalType[] = ["cat", "rabbit", "bear"];

    const spawn = (post: Post, gy: number, cw: number) => {
      const type = TYPES[Math.floor(Math.random() * 3)];
      const goRight = Math.random() > 0.5;
      seenRef.current.add(post.id);
      try {
        localStorage.setItem("iv_seen", JSON.stringify(Array.from(seenRef.current).slice(-150)));
      } catch { /* ignore */ }

      animalsRef.current.push({
        id: crypto.randomUUID(), postId: post.id,
        x: goRight ? -SPRITE_W[type] * S - 20 : cw + 20,
        y: gy - SPRITE_H[type] * S - 4,
        text: post.content, type,
        frame: 0, frameTimer: 0,
        speed: (goRight ? 1 : -1) * (1.2 + Math.random() * 0.6),
        opacity: 0, fading: false,
        collecting: false, collectTimer: 0,
      });
    };

    const loop = (ts: number) => {
      const { width: W, height: H } = canvas;
      const gy = H * GROUND;
      const frame = frameRef.current++;

      ctx.imageSmoothingEnabled = false;

      // 新しい動物をスポーン
      if (ts - lastSpawn > SPAWN_MS && queueRef.current.length > 0) {
        spawn(queueRef.current.shift()!, gy, W);
        lastSpawn = ts;
      }

      // 背景描画
      ctx.clearRect(0, 0, W, H);
      if (bgImageRef.current) {
        const img = bgImageRef.current;
        const scale = Math.max(W / img.width, H / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (W - drawW) / 2;
        const drawY = (H - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        drawBg(ctx, W, H);
      }

      // 星のキラキラアニメーション
      drawStars(ctx, starsRef.current, W, H, frame);

      // 炎のグロー（明滅する環境光）
      drawFireGlow(ctx, W / 2, H * 0.79, frame);

      // 焚き火の火花パーティクル
      const fireCx = W / 2;
      const fireCy = H * 0.79; // 画像の炎の中心付近

      // 火花を生成
      const spawnCount = Math.random() < 0.7 ? Math.ceil(Math.random() * 3) : 0;
      for (let i = 0; i < spawnCount; i++) {
        if (sparksRef.current.length < 80) {
          const maxLife = 35 + Math.random() * 45;
          sparksRef.current.push({
            x: fireCx + (Math.random() - 0.5) * 120,
            y: fireCy + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 4.5,
            vy: -(1.2 + Math.random() * 2.8),
            life: maxLife, maxLife,
            size: S,
            colorIdx: Math.floor(Math.random() * SPARK_COLORS.length),
          });
        }
      }

      // 火花を更新・描画
      sparksRef.current = sparksRef.current.filter((sp) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy *= 0.97;
        sp.vx *= 0.98;
        sp.life--;
        if (sp.life <= 0) return false;
        const alpha = sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = SPARK_COLORS[sp.colorIdx];
        ctx.fillRect(sp.x | 0, sp.y | 0, sp.size, sp.size);
        ctx.restore();
        return true;
      });

      // 風アニメーション
      if (ts > nextGustRef.current) {
        const count = 12 + Math.floor(Math.random() * 16);
        const baseY = H * (0.15 + Math.random() * 0.65);
        const dir = Math.random() > 0.25 ? 1 : -1;
        for (let i = 0; i < count; i++) {
          const len = 40 + Math.random() * 90;
          windRef.current.push({
            x: dir > 0 ? -len - Math.random() * 150 : W + Math.random() * 150,
            y: baseY + (Math.random() - 0.5) * 120,
            speed: dir * (4 + Math.random() * 5),
            length: len,
            opacity: 0,
            maxOpacity: 0.12 + Math.random() * 0.18,
            delay: Math.random() * 40,
          });
        }
        nextGustRef.current = ts + 6000 + Math.random() * 10000;
      }

      windRef.current = windRef.current.filter((w) => {
        if (w.delay > 0) { w.delay--; return true; }
        w.x += w.speed;
        const progress = w.speed > 0
          ? (w.x + w.length) / (W + w.length)
          : 1 - w.x / (W + w.length);
        w.opacity = w.maxOpacity * Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
        if (w.speed > 0 && w.x > W + 10) return false;
        if (w.speed < 0 && w.x + w.length < -10) return false;
        ctx.save();
        ctx.globalAlpha = w.opacity;
        ctx.fillStyle = "#c8dcff";
        ctx.fillRect(w.speed > 0 ? w.x | 0 : (w.x - w.length) | 0, w.y | 0, w.length | 0, 1);
        ctx.restore();
        return true;
      });

      // 動物を更新・描画
      const newBubbles = new Map<string, BubbleRect>();

      animalsRef.current = animalsRef.current.filter((a) => {
        a.x += a.speed;
        a.opacity = Math.min(1, a.opacity + 0.04);
        if (++a.frameTimer >= 20) { a.frame ^= 1; a.frameTimer = 0; }

        if (a.collecting) {
          a.collectTimer++;
          if (a.collectTimer >= 55) { onFuelCollected(); a.fading = true; }
        }
        if (a.fading) {
          a.opacity -= 0.06;
          if (a.opacity <= 0) return false;
        }
        if (a.speed > 0 && a.x > W + SPRITE_W[a.type] * S + 50) return false;
        if (a.speed < 0 && a.x < -SPRITE_W[a.type] * S - 50) return false;

        // 動物描画（左向きはcanvasを反転）
        const sw = SPRITE_W[a.type] * S;
        ctx.save();
        ctx.globalAlpha = a.opacity;
        if (a.speed < 0) {
          ctx.scale(-1, 1);
          const fx = -(a.x + sw);
          if (a.type === "cat")    drawCat(ctx, fx, a.y, a.frame);
          else if (a.type === "rabbit") drawRabbit(ctx, fx, a.y, a.frame);
          else drawBear(ctx, fx, a.y, a.frame);
        } else {
          if (a.type === "cat")    drawCat(ctx, a.x, a.y, a.frame);
          else if (a.type === "rabbit") drawRabbit(ctx, a.x, a.y, a.frame);
          else drawBear(ctx, a.x, a.y, a.frame);
        }
        ctx.restore();

        // 吹き出し
        const cx = a.x + sw / 2;
        const rect = drawBubble(ctx, cx, a.y, a.text, a.opacity);
        newBubbles.set(a.id, rect);

        // 燃料収集プログレスバー
        if (a.collecting) {
          const p = a.collectTimer / 55;
          ctx.fillStyle = "rgba(255,200,0,0.85)";
          ctx.fillRect(a.x | 0, a.y - 10, (sw * p) | 0, 4);
        }

        return true;
      });

      bubbleRef.current = newBubbles;
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [sessionId, onFuelCollected]);

  // 長押しで燃料収集
  const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    for (const a of animalsRef.current) {
      if (a.fading || a.collecting) continue;
      const br = bubbleRef.current.get(a.id);
      if (br && px >= br.x && px <= br.x + br.w && py >= br.y && py <= br.y + br.h) {
        a.collecting = true; a.collectTimer = 0; break;
      }
    }
  }, []);

  const onUp = useCallback(() => {
    for (const a of animalsRef.current) {
      if (a.collecting && a.collectTimer < 55) { a.collecting = false; a.collectTimer = 0; }
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    />
  );
}
