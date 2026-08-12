import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, X, Camera } from "lucide-react";

/**
 * QR / Barcode scanner button.
 * Props:
 *   onScan(decodedText)  — called when a code is decoded (auto-closes)
 *   label                — button label (default "Kamera ile Tara")
 *   testid               — data-testid for button
 */
export default function QrScannerButton({ onScan, label = "Kamera ile Tara", testid = "qr-open" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const containerId = "qr-reader-region";

  useEffect(() => {
    if (!open) return;
    setError("");
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    let cancelled = false;

    Html5Qrcode.getCameras().then((cams) => {
      if (cancelled || !cams || cams.length === 0) {
        setError("Kamera bulunamadı");
        return;
      }
      // Prefer back camera on phones
      const back = cams.find((c) => /back|rear|environment/i.test(c.label)) || cams[cams.length - 1];
      scanner.start(
        back.id,
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded) => {
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
            scannerRef.current = null;
          }
          setOpen(false);
          onScan?.(decoded);
        },
        () => {}
      ).catch((e) => setError(e.message || "Kamera açılamadı"));
    }).catch(() => setError("Kamera erişimi reddedildi"));

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, onScan]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testid}
        className="h-14 px-5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center gap-2 transition-all active:scale-95 border border-slate-600">
        <QrCode className="w-5 h-5" /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-4" role="dialog">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                <div className="font-display font-bold">Kod / Barkod Tara</div>
              </div>
              <button onClick={() => setOpen(false)} data-testid="qr-close" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div id={containerId} className="rounded-lg overflow-hidden bg-black min-h-[300px]" />
              {error && <div className="mt-3 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">{error}</div>}
              <p className="text-xs text-slate-500 mt-3 text-center">Ürün kodunu (KU-001 gibi) veya barkodu kameraya gösterin.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
