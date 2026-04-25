"use client";

import { useEffect, useRef, useState } from "react";
import type { TeilnehmerQRPayload } from "@/types";

interface Props {
  onScan: (payload: TeilnehmerQRPayload) => void;
}

export default function InlineQRScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (!videoRef.current || !activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        async function decode() {
          if (!activeRef.current || !videoRef.current) return;
          try {
            const result = await reader.decodeOnceFromVideoElement(videoRef.current);
            if (!activeRef.current) return;
            try {
              const parsed = JSON.parse(result.getText()) as TeilnehmerQRPayload;
              if (typeof parsed.id === "string" && typeof parsed.name === "string") {
                onScan(parsed);
                // Keep scanning (don't stop) for multi-scan
                setTimeout(decode, 500);
                return;
              }
            } catch { /* not our format */ }
            decode();
          } catch {
            if (activeRef.current) decode();
          }
        }
        decode();
      } catch (err) {
        if (!activeRef.current) return;
        setError(err instanceof Error ? err.message : "Kamera nicht verfügbar");
      }
    }

    startScanner();

    return () => {
      activeRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-6 px-5 text-center">
        <div>
          <p className="text-sm font-medium text-destructive mb-1">Kamerafehler</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black" style={{ aspectRatio: "4/3", maxHeight: "240px" }}>
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {/* Viewfinder overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-36 h-36 relative">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br" />
        </div>
      </div>
      <style>{`
        @keyframes scanline { 0%,100% { top: 4px } 50% { top: calc(100% - 4px) } }
      `}</style>
    </div>
  );
}
