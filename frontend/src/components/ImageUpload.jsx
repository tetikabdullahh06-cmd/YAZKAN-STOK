import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

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
      onChange(response.data.image_url);
      toast.success("Görsel yüklendi");
    } catch (error) { toast.error(error.response?.data?.detail || "Görsel yüklenemedi"); }
    finally { setUploading(false); event.target.value = ""; }
  };
  return <div>
    <label className="block text-sm font-black text-slate-800 mb-2">{label}</label>
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-slate-900 hover:bg-slate-700 text-white font-black cursor-pointer">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        {uploading ? "Yükleniyor..." : "Görsel seç"}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="hidden" />
      </label>
      {value && <div className="relative group w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-100">
        <img src={value} alt={label} className="w-full h-full object-cover" />
        <button type="button" onClick={() => onChange("")} className="absolute top-0 right-0 hidden group-hover:flex bg-red-700 text-white rounded-bl p-1" aria-label="Görseli kaldır"><X className="w-3 h-3" /></button>
      </div>}
    </div>
  </div>;
}

export function ImageHover({ src, alt = "Görsel" }) {
  if (!src) return null;
  return <span className="relative inline-flex align-middle ml-2 group">
    <img src={src} alt={alt} className="w-9 h-9 rounded-md object-cover border border-slate-300" />
    <span className="pointer-events-none absolute z-50 left-0 top-10 hidden group-hover:block w-56 h-56 rounded-xl overflow-hidden border-2 border-white shadow-2xl bg-white">
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </span>
  </span>;
}
