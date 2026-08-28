import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { createWorker } from "tesseract.js";
import { QrCode, X, Camera, Upload, Loader2 } from "lucide-react";

/** QR / barcode camera scanner with direct local image upload support. */
export default function QrScannerButton({ onScan, label = "Kamera ile Tara", testid = "qr-open" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [fileScanning, setFileScanning] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerId = "qr-reader-region";

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.AZTEC,
      ],
    });
    scannerRef.current = scanner;
    setError("");

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 160 },
      aspectRatio: 1.777778,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.AZTEC,
      ],
    };
    const stopScanner = async () => {
      const current = scannerRef.current;
      scannerRef.current = null;
      if (!current) return;
      try { await current.stop(); } catch (_) {}
      try { await current.clear(); } catch (_) {}
    };
    const handleDecoded = async (decoded) => {
      if (cancelled) return;
      await stopScanner();
      if (!cancelled) {
        setOpen(false);
        setPendingFile(null);
        onScan?.(decoded);
      }
    };
    const scanFile = async () => {
      if (!pendingFile) return;
      setFileScanning(true);
      try {
        const decoded = await scanner.scanFile(pendingFile, true);
        await stopScanner();
        if (!cancelled) {
          setPendingFile(null);
          setOpen(false);
          onScan?.(decoded);
        }
      } catch (_) {
        // Kare kod/barkod yoksa ikinci aşamada görseldeki ürün adı veya kodunu OCR ile oku.
        try { await scanner.clear(); } catch (_) {}
        scannerRef.current = null;
        if (!cancelled) {
          setOcrScanning(true);
          setError("");
          let worker;
          try {
            worker = await createWorker("tur");
            const result = await worker.recognize(pendingFile);
            const text = result?.data?.text?.replace(/\s+/g, " ").trim();
            if (!text) throw new Error("OCR_EMPTY");
            setPendingFile(null);
            setOpen(false);
            onScan?.(text);
          } catch (ocrError) {
            if (!cancelled) setError("Görselde QR/barkod bulunamadı ve ürün adı veya kodu okunamadı. Ürün etiketini daha net, yakın ve düz çekerek tekrar deneyin.");
          } finally {
            try { await worker?.terminate(); } catch (_) {}
            if (!cancelled) setOcrScanning(false);
          }
        }
        if (!cancelled) setPendingFile(null);
      } finally {
        if (!cancelled) setFileScanning(false);
      }
    };
    const startCamera = async () => {
      if (pendingFile) return;
      try {
        await scanner.start({ facingMode: "environment" }, config, handleDecoded, () => {});
      } catch (firstError) {
        if (cancelled) return;
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras?.length) throw firstError;
          const camera = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
          await scanner.start(camera.id, config, handleDecoded, () => {});
        } catch (secondError) {
          if (!cancelled) setError(secondError?.message?.toLowerCase().includes("permission")
            ? "Kamera izni verilmedi. Tarayıcı ayarlarından kamera iznini açıp tekrar deneyin."
            : "Kamera açılamadı. HTTPS bağlantısını ve kamera iznini kontrol edin.");
        }
      }
    };
    const timer = window.setTimeout(pendingFile ? scanFile : startCamera, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopScanner();
    };
  }, [open, onScan, pendingFile]);

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Lütfen QR veya barkod içeren bir görsel seçin.");
      return;
    }
    setError("");
    setPendingFile(file);
    setOpen(true);
  };
  const close = () => { setPendingFile(null); setOpen(false); setError(""); setOcrScanning(false); };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => setOpen(true)} data-testid={testid}
          className="h-14 px-5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold flex items-center gap-2 transition-all active:scale-95 border border-slate-600">
          <QrCode className="w-5 h-5" /> {label}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={selectImage} className="hidden" data-testid={`${testid}-image-input`} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileScanning || ocrScanning} data-testid={`${testid}-image-upload-direct`}
          className="h-14 px-5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 border border-cyan-400/50 shadow-lg shadow-cyan-900/20">
          {fileScanning || ocrScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} {ocrScanning ? "Yazı okunuyor..." : "Görsel Yükle"}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Kod ve barkod tara">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2"><Camera className="w-5 h-5 text-blue-400" /><div className="font-display font-bold">Kod / Barkod Tara</div></div>
              <button type="button" onClick={close} data-testid="qr-close" aria-label="Kamerayı kapat" className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <div id={containerId} className="rounded-lg overflow-hidden bg-black min-h-[300px] w-full" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileScanning || ocrScanning} data-testid={`${testid}-image-upload`} className="mt-3 w-full h-11 rounded-lg border border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {fileScanning || ocrScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {ocrScanning ? "Ürün yazısı okunuyor..." : fileScanning ? "Kod okunuyor..." : "Bu pencerede görsel seç"}
              </button>
              {error && <div className="mt-3 text-sm bg-red-500/10 border border-red-500/30 text-red-200 rounded-lg p-3">{error}</div>}
              <p className="text-xs text-slate-400 mt-3 text-center">Kamera, QR/barkod veya üzerinde ürün adı/kodu bulunan net bir görsel yükleyebilirsiniz.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
