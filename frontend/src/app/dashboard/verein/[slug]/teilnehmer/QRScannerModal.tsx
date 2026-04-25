"use client";

import { useEffect, useRef, useState } from "react";
import type { TeilnehmerQRPayload } from "@/types";

interface Props {
  onScan: (payload: TeilnehmerQRPayload) => void;
  onClose: () => void;
}

export default function QRScannerModal({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserQRCodeReader | null>(null);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        readerRef.current = reader;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;

        if (!videoRef.current || !active) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // Decode loop
        async function decode() {
          if (!active || !videoRef.current) return;
          try {
            const result = await reader.decodeOnceFromVideoElement(videoRef.current);
            if (!active) return;
            const text = result.getText();
            try {
              const parsed = JSON.parse(text) as TeilnehmerQRPayload;
              if (typeof parsed.id === "string" && typeof parsed.name === "string") {
                setScanning(false);
                onScan(parsed);
                return;
              }
            } catch {
              // not our format — keep scanning
            }
            // try again
            decode();
          } catch {
            if (active) decode();
          }
        }
        decode();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Kamera nicht verfügbar");
      }
    }

    startScanner();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            QR-Code scannen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black aspect-square">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-destructive font-medium mb-2">Kamerafehler</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary rounded-br" />
                  {scanning && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/70 animate-[scan_1.5s_ease-in-out_infinite]" />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <style>{`
          @keyframes scan {
            0% { top: 0; }
            50% { top: calc(100% - 2px); }
            100% { top: 0; }
          }
        `}</style>

        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground text-center">
            Halte die Kamera auf einen Teilnehmer-QR-Code
          </p>
        </div>
      </div>
    </div>
  );
}
