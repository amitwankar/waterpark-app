"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DetectResult = { rawValue?: string };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectResult[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

interface DeviceQrScannerProps {
  onDetected: (value: string) => void;
  className?: string;
}

export function DeviceQrScanner({ onDetected, className }: DeviceQrScannerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<{ detect: (source: ImageBitmapSource) => Promise<DetectResult[]> } | null>(null);
  const lastDetectedAtRef = useRef<number>(0);
  const onDetectedRef = useRef(onDetected);

  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  onDetectedRef.current = onDetected;

  const canUseBarcodeDetector = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.BarcodeDetector);
  }, []);

  const stopScanner = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const runDetectLoop = useCallback(() => {
    const tick = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
        return;
      }

      try {
        const detections = await detector.detect(video);
        const value = detections.find((item) => typeof item.rawValue === "string" && item.rawValue.trim().length > 0)?.rawValue?.trim();
        if (value) {
          const now = Date.now();
          if (now - lastDetectedAtRef.current > 1800) {
            lastDetectedAtRef.current = now;
            onDetectedRef.current(value);
          }
        }
      } catch {
        // Ignore frame-level detection errors and continue.
      }

      rafRef.current = requestAnimationFrame(() => {
        void tick();
      });
    };

    rafRef.current = requestAnimationFrame(() => {
      void tick();
    });
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      if (!canUseBarcodeDetector || !window.BarcodeDetector) {
        setSupported(false);
        setError("Live QR camera scan is not supported in this browser. Use Chrome/Edge latest.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      runDetectLoop();
      setEnabled(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to access camera.";
      setError(message);
      setEnabled(false);
    } finally {
      setStarting(false);
    }
  }, [canUseBarcodeDetector, runDetectLoop]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  function handleToggle(): void {
    if (enabled) {
      stopScanner();
      setEnabled(false);
      return;
    }
    void startScanner();
  }

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-black/90">
        <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
        {!enabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-white">
            Camera is off
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={starting}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-60"
        >
          {enabled ? "Stop Camera" : starting ? "Starting..." : "Start Camera"}
        </button>
        {supported ? <span className="text-xs text-[var(--color-text-muted)]">Point camera at QR code</span> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

