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
  const zxingReaderRef = useRef<{ reset?: () => void } | null>(null);
  const zxingControlsRef = useRef<{ stop?: () => void } | null>(null);
  const lastDetectedAtRef = useRef<number>(0);
  const onDetectedRef = useRef(onDetected);

  const [enabled, setEnabled] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");

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
    if (zxingControlsRef.current?.stop) {
      zxingControlsRef.current.stop();
    }
    zxingControlsRef.current = null;
    if (zxingReaderRef.current?.reset) {
      zxingReaderRef.current.reset();
    }
    zxingReaderRef.current = null;
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
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("Camera requires HTTPS. Open this page on secure HTTPS domain.");
        setEnabled(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera API not available in this browser.");
        setEnabled(false);
        return;
      }
      if ("permissions" in navigator && navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: "camera" as PermissionName });
          setPermissionState((status.state as "prompt" | "granted" | "denied") ?? "unknown");
          status.onchange = () => {
            setPermissionState((status.state as "prompt" | "granted" | "denied") ?? "unknown");
          };
          if (status.state === "denied") {
            setError("Camera permission is blocked. Enable camera access in browser site settings, then retry.");
            setEnabled(false);
            return;
          }
        } catch {
          setPermissionState("unknown");
        }
      }

      if (!canUseBarcodeDetector || !window.BarcodeDetector) {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        zxingReaderRef.current = reader as { reset?: () => void };
        setSupported(true);

        const video = videoRef.current;
        if (!video) {
          setError("Camera view is not available.");
          setEnabled(false);
          return;
        }

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result) => {
            const value = result?.getText?.()?.trim?.();
            if (!value) return;
            const now = Date.now();
            if (now - lastDetectedAtRef.current > 1800) {
              lastDetectedAtRef.current = now;
              onDetectedRef.current(value);
            }
          },
        );

        zxingControlsRef.current = controls as { stop?: () => void };
        setEnabled(true);
        setPermissionState("granted");
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
      setPermissionState("granted");
    } catch (err) {
      const name = typeof err === "object" && err && "name" in err ? String((err as { name?: string }).name) : "";
      let message = err instanceof Error ? err.message : "Unable to access camera.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        message = "Camera permission denied. Allow camera in browser settings and tap Start Camera again.";
        setPermissionState("denied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        message = "No camera found on this device.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        message = "Camera is in use by another app. Close other camera apps and retry.";
      }
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
      {permissionState === "denied" ? (
        <p className="mt-1 text-xs text-amber-700">
          Camera blocked: open browser site settings and allow Camera permission.
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
