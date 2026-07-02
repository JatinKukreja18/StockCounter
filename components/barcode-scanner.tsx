"use client";

import { useEffect, useId, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BarcodeScanner({
  open,
  onClose,
  onScan
}: {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}) {
  const rawId = useId();
  const elementId = `scanner-${rawId.replaceAll(":", "")}`;
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(elementId);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 150 }, aspectRatio: 1.5 },
          (decodedText) => {
            onScan(decodedText);
            onClose();
          },
          () => undefined
        );
      } catch {
        setError("Camera could not start. Check camera permission or enter the barcode below.");
      }
    }

    const timer = window.setTimeout(start, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (scanner?.isScanning) void scanner.stop().catch(() => undefined);
    };
  }, [elementId, onClose, onScan, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#101713] text-white">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="font-bold">Scan barcode</p>
          <p className="text-xs text-white/60">Hold steady inside the frame</p>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose} aria-label="Close scanner"><X /></Button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div id={elementId} className="w-full max-w-xl overflow-hidden [&_video]:min-h-[55dvh] [&_video]:object-cover" />
        {!error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-40 w-[min(80vw,320px)] rounded-2xl border-2 border-white/80">
              <span className="scan-line absolute inset-x-3 top-3 h-0.5 bg-[#5ee39d] shadow-[0_0_10px_#5ee39d]" />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-white/10 p-6 text-center backdrop-blur">
            <Camera className="mx-auto mb-3" />
            <p className="text-sm leading-6">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
