import { useEffect, useState } from "react";
import { ImagePlus, Loader2, X, Maximize2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export function ImageLightbox({ src, alt = "Görsel", children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previous; };
  }, [open]);
  if (!src) return children || null;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`${alt} görselini büyüt`} className="group relative inline-flex cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400 rounded-lg">
      {children || <img src={src} alt={alt} className="max-w-full" />}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/0 text-white opacity-0 transition-all duration-200 group-hover:bg-slate-950/35 group-hover:opacity-100"><Maximize2 className="h-5 w-5 drop-shadow" /></span>
    </button>
    {open && <div role="dialog" aria-modal="true" aria-label={`${alt} büyük görünüm`} className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 p-4 md:p-8 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="relative flex max-h-[92vh] max-w-[96vw] items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <img src={src} alt={alt} className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain shadow-2xl" />
        <button type="button" onClick={() => setOpen(false)} aria-label="Büyük görseli kapat" className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"><X className="h-5 w-5" /></button>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-sm font-bold text-white/90">Kapatmak için görsel dışına veya ESC tuşuna basın</div>
    </div>}
  </>;
}

export default function ImageUpload({ value, onChange, label = "Görsel" }) {
  const [uploading, setUploading] = useState(false);
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Lütfen bir görsel dosyası seçin");
    if (file.size > 5 * 1024 * 1024) return toast.error("Görsel boyutu en fazla 5 MB olabilir");
    setUploading(true);
    try {
      const data = new FormData(); data.append("file", file);
      const response = await api.post("/images/upload", data, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(response.data.image_url); toast.success("Görsel yüklendi");
    } catch (error) { toast.error(error.response?.data?.detail || "Görsel yüklenemedi"); }
    finally { setUploading(false); event.target.value = ""; }
  };
  return <div>
    <label className="block text-sm font-black text-slate-800 mb-2">{label}</label>
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-slate-900 hover:bg-slate-700 text-white font-black cursor-pointer">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}{uploading ? "Yükleniyor..." : "Görsel seç"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" /></label>
      {value && <div className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-100">
        <ImageLightbox src={value} alt={label}><img src={value} alt={label} className="w-full h-full object-cover" /></ImageLightbox>
        <button type="button" onClick={() => onChange("")} className="absolute top-0 right-0 hidden group-hover:flex bg-red-700 text-white rounded-bl p-1" aria-label="Görseli kaldır"><X className="w-3 h-3" /></button>
      </div>}
    </div>
  </div>;
}

export function ImageHover({ src, alt = "Görsel" }) {
  const [preview, setPreview] = useState(null);
  if (!src) return null;
  const showPreview = (event) => {
    const rect = event.currentTarget.getBoundingClientRect(); const size = 224;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - size - 8));
    const top = rect.bottom + size + 8 <= window.innerHeight ? rect.bottom + 8 : Math.max(8, rect.top - size - 8);
    setPreview({ left, top });
  };
  return <span className="relative inline-flex align-middle ml-2">
    <ImageLightbox src={src} alt={alt}><img src={src} alt={alt} onMouseEnter={showPreview} onMouseLeave={() => setPreview(null)} className="w-9 h-9 rounded-md object-cover border border-slate-300 cursor-zoom-in" /></ImageLightbox>
    {preview && <span onMouseEnter={() => setPreview(preview)} onMouseLeave={() => setPreview(null)} style={{ position: "fixed", zIndex: 9999, left: preview.left, top: preview.top, width: 224, height: 224 }} className="pointer-events-auto rounded-xl overflow-hidden border-2 border-white shadow-2xl bg-white p-1">
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </span>}
  </span>;
}
