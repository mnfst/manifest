"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createNoise3D } from "simplex-noise";

const DEFAULT_LIGHT_COLORS = [
  "#E8F4F8",
  "#E5EEF8",
  "#EDE8F5",
  "#F0E8F2",
  "#E6F2F0",
];

const DEFAULT_DARK_COLORS = [
  "#1a2a3a",
  "#1a2535",
  "#251a35",
  "#2a1a30",
  "#1a2a2a",
];

export const WaveCanvas = ({
  colors,
  darkColors,
  waveWidth,
  blur = 20,
  speed = "slow",
  waveOpacity = 0.7,
}: {
  colors?: string[];
  darkColors?: string[];
  waveWidth?: number;
  blur?: number;
  speed?: "slow" | "fast";
  waveOpacity?: number;
}) => {
  const noiseRef = useRef(createNoise3D());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDarkRef = useRef(false);
  const animationIdRef = useRef<number>(0);
  const contextRef = useRef<{
    w: number;
    h: number;
    nt: number;
    ctx: CanvasRenderingContext2D | null;
  }>({ w: 0, h: 0, nt: 0, ctx: null });

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const dark = document.documentElement.classList.contains("dark");
      isDarkRef.current = dark;
    };

    checkDarkMode();

    // Watch for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

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

  const lightColors = useMemo(() => colors ?? DEFAULT_LIGHT_COLORS, [colors]);
  const darkColorsResolved = useMemo(() => darkColors ?? DEFAULT_DARK_COLORS, [darkColors]);

  const drawWave = useCallback((n: number) => {
    const { ctx, w, h } = contextRef.current;
    if (!ctx) return;
    const waveColors = isDarkRef.current ? darkColorsResolved : lightColors;

    contextRef.current.nt += speedValue;
    const nt = contextRef.current.nt;
    const noise = noiseRef.current;

    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.lineWidth = waveWidth || 80;
      ctx.strokeStyle = waveColors[i % waveColors.length];
      for (let x = 0; x < w; x += 5) {
        const y = noise(x / 600, 0.4 * i, nt) * 180;
        ctx.lineTo(x, y + h * 0.5);
      }
      ctx.stroke();
      ctx.closePath();
    }
  }, [lightColors, darkColorsResolved, waveWidth, speedValue]);

  const render = useCallback(() => {
    const { ctx, w, h } = contextRef.current;
    if (!ctx) return;
    // Draw background at full opacity
    ctx.globalAlpha = 1;
    ctx.fillStyle = isDarkRef.current ? "#0a0a0a" : "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    // Draw waves with specified opacity
    ctx.globalAlpha = waveOpacity || 0.7;
    drawWave(5);
    animationIdRef.current = requestAnimationFrame(render);
  }, [drawWave, waveOpacity]);

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
    <canvas
      className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none"
      ref={canvasRef}
      id="wave-canvas"
      style={{
        ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
      }}
    />
  );
};
