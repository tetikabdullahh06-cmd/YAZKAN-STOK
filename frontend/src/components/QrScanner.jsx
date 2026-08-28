import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, X, Camera, Upload, Loader2 } from "lucide-react";

/**
 * QR / barcode scanner button.
 * Camera access requires HTTPS (or localhost) and browser permission.
 */
export default function QrScannerButton({ onScan, label = "Kamera ile Tara", testid = "qr-open" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileScanning, setFileScanning] = useState(false);
  const containerId = "qr-reader-region";

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    setError("");

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 160 },
      aspectRatio: 1.777778,
    };

    const stopScanner = async () => {
      const current = scannerRef.current;
      scannerRef.current = null;
      if (!current) return;
      try {
        await current.stop();
      } catch (_) {
        // Scanner may not have started yet.
      }
      try {
        await current.clear();
      } catch (_) {
        // The container may already have been unmounted.
      }
    };

    const handleDecoded = async (decoded) => {
      if (cancelled) return;
      await stopScanner();
      if (!cancelled) {
        setOpen(false);
        onScan?.(decoded);
      }
    };

    const startScanner = async () => {
      try {
        // facingMode lets mobile browsers request the rear camera without
        // requiring a camera list before permission is granted.
        await scanner.start({ facingMode: "environment" }, config, handleDecoded, () => {});
      } catch (firstError) {
        if (cancelled) return;
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras?.length) throw firstError;
          const camera = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
          await scanner.start(camera.id, config, handleDecoded, () => {});
        } catch (secondError) {
          if (!cancelled) {
            const message = secondError?.message || firstError?.message || "Kamera açılamadı";
            setError(message.includes("Permission") || message.includes("permission")
              ? "Kamera izni verilmedi. Tarayıcı ayarlarından kamera iznini açıp tekrar deneyin."
              : "Kamera açılamadı. Sayfanın HTTPS üzerinden açıldığını ve kamera izninin verildiğini kontrol edin.");
          }
        }
      }
    };

    // Wait one frame so the dialog container is mounted before html5-qrcode
    // tries to attach its video element.
    const timer = window.setTimeout(startScanner, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan]);

  const close = () => setOpen(false);

  const scanUploadedImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Lütfen QR veya barkod içeren bir görsel seçin.");
      return;
    }
    setError("");
    setFileScanning(true);
    const scanner = scannerRef.current || new Html5Qrcode(containerId);
    scannerRef.current = scanner;
    try {
      try { await scanner.stop(); } catch (_) {}
      try { await scanner.clear(); } catch (_) {}
      const decoded = await scanner.scanFile(file, true);
      scannerRef.current = null;
      setOpen(false);
      onScan?.(decoded);
    } catch (_) {
      setError("Görselde okunabilir QR/kare kod veya barkod bulunamadı. Daha net bir görsel deneyin.");
      try { await scanner.clear(); } catch (_) {}
      scannerRef.current = null;
    } finally {
      setFileScanning(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={testid}
        className="h-14 px-5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center gap-2 transition-all active:scale-95 border border-slate-600"
      >
        <QrCode className="w-5 h-5" /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Kod ve barkod tara">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                <div className="font-display font-bold">Kod / Barkod Tara</div>
              </div>
              <button type="button" onClick={close} data-testid="qr-close" aria-label="Kamerayı kapat" className="p-2 rounded-lg hover:bg-slate-800 text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div id={containerId} className="rounded-lg overflow-hidden bg-black min-h-[300px] w-full" />
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={scanUploadedImage} className="hidden" data-testid={`${testid}-image-input`} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileScanning} data-testid={`${testid}-image-upload`} className="mt-3 w-full h-11 rounded-lg border border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {fileScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {fileScanning ? "Görsel okunuyor..." : "Bilgisayardan / Telefondan Görsel Yükle"}
              </button>
              {error && <div className="mt-3 text-sm bg-red-500/10 border border-red-500/30 text-red-700 rounded-lg p-3">{error}</div>}
              <p className="text-xs text-slate-500 mt-3 text-center">Kamerayı kullanabilir veya QR/kare kod ya da barkod görseli yükleyebilirsiniz.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
