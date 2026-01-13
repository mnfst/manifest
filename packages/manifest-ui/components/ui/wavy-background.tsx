"use client";
import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createNoise3D } from "simplex-noise";

const DEFAULT_WAVE_COLORS = [
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#e879f9",
  "#22d3ee",
];

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  colors?: string[];
  waveWidth?: number;
  backgroundFill?: string;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
  [key: string]: unknown;
}) => {
  const noiseRef = useRef(createNoise3D());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);
  const contextRef = useRef<{
    w: number;
    h: number;
    nt: number;
    ctx: CanvasRenderingContext2D | null;
  }>({ w: 0, h: 0, nt: 0, ctx: null });

  const speedValue = useMemo(() => {
    switch (speed) {
      case "slow":
        return 0.0003;
      case "fast":
        return 0.001;
      default:
        return 0.0005;
    }
  }, [speed]);

  const waveColors = useMemo(() => colors ?? DEFAULT_WAVE_COLORS, [colors]);

  const drawWave = useCallback((n: number) => {
    const { ctx, w, h } = contextRef.current;
    if (!ctx) return;
    contextRef.current.nt += speedValue;
    const nt = contextRef.current.nt;
    const noise = noiseRef.current;

    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.lineWidth = waveWidth || 50;
      ctx.strokeStyle = waveColors[i % waveColors.length];
      for (let x = 0; x < w; x += 5) {
        const y = noise(x / 600, 0.4 * i, nt) * 180;
        ctx.lineTo(x, y + h * 0.5);
      }
      ctx.stroke();
      ctx.closePath();
    }
  }, [waveColors, waveWidth, speedValue]);

  const render = useCallback(() => {
    const { ctx, w, h } = contextRef.current;
    if (!ctx) return;
    ctx.fillStyle = backgroundFill || "black";
    ctx.globalAlpha = waveOpacity || 0.5;
    ctx.fillRect(0, 0, w, h);
    drawWave(5);
    animationIdRef.current = requestAnimationFrame(render);
  }, [backgroundFill, waveOpacity, drawWave]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    contextRef.current.ctx = ctx;
    contextRef.current.w = ctx.canvas.width = window.innerWidth;
    contextRef.current.h = ctx.canvas.height = window.innerHeight;
    contextRef.current.nt = 0;
    ctx.filter = `blur(${blur}px)`;

    const handleResize = () => {
      if (!ctx) return;
      contextRef.current.w = ctx.canvas.width = window.innerWidth;
      contextRef.current.h = ctx.canvas.height = window.innerHeight;
      ctx.filter = `blur(${blur}px)`;
    };

    window.addEventListener("resize", handleResize);
    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationIdRef.current);
    };
  }, [blur, render]);

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(
      typeof window !== "undefined" &&
        navigator.userAgent.includes("Safari") &&
        !navigator.userAgent.includes("Chrome")
    );
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        containerClassName
      )}
    >
      <canvas
        className="absolute inset-0 z-0"
        ref={canvasRef}
        id="canvas"
        style={{
          ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
        }}
      ></canvas>
      <div className={cn("relative z-10", className)} {...props}>
        {children}
      </div>
    </div>
  );
};
