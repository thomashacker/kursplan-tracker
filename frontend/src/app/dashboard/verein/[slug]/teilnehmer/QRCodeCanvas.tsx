"use client";

import { useEffect, useRef } from "react";
import type { TeilnehmerQRPayload } from "@/types";

interface Props {
  payload: TeilnehmerQRPayload;
  size?: number;
}

export default function QRCodeCanvas({ payload, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const QRCode = await import("qrcode");
      if (cancelled || !canvasRef.current) return;
      await QRCode.toCanvas(canvasRef.current, JSON.stringify(payload), {
        width: size,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
    render();
    return () => { cancelled = true; };
  }, [payload, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="rounded" />;
}
