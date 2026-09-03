import { useRef, useState } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { FileUp, FileDown, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Excel bulk import modal for tool holders.
 * Props: onClose(), onCommitted() — refreshes parent list
 */
export default function ToolHolderImport({ onClose, onCommitted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef(null);

  const runPreview = async (f) => {
    setLoading(true);
    setPreview(null);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const token = localStorage.getItem("access_token");
      const r = await fetch(`${API}/toolholders/import?commit=false`, {
        method: "POST", credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); }
      catch { throw new Error(`Sunucu geçersiz yanıt döndürdü (${r.status}): ${text.slice(0, 200)}`); }
      if (!r.ok) throw new Error((d && d.detail) || "Önizleme başarısız");
      setPreview(d);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    runPreview(f);
  };

  const commit = async () => {
    if (!file) return;
    setCommitting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("access_token");
      const r = await fetch(`${API}/toolholders/import?commit=true`, {
        method: "POST", credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const text = await r.text();
      let d;
      try { d = JSON.parse(text); }
      catch { throw new Error(`Sunucu geçersiz yanıt döndürdü (${r.status}): ${text.slice(0, 200)}`); }
      if (!r.ok) throw new Error((d && d.detail) || "İçe aktarma başarısız");
      toast.success(`${d.created} yeni, ${d.updated} güncellendi`);
      onCommitted?.();
      onClose?.();
    } catch (e) { toast.error(e.message); }
    setCommitting(false);
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const r = await fetch(`${API}/toolholders/import/template`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tutucu_sablonu.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Şablon indirilemedi"); }
  };

  const stats = preview?.stats;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">Toplu Yükleme</div>
            <div className="font-display text-xl font-bold">Tutucuları Excel'den İçe Aktar</div>
          </div>
          <button onClick={onClose} data-testid="th-import-close" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex-1 overflow-auto space-y-4">
          <div className="flex flex-wrap gap-3">
            <button onClick={downloadTemplate} data-testid="th-import-template"
              className="h-12 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2">
              <FileDown className="w-4 h-4" /> Şablon İndir
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" data-testid="th-import-file" />
            <button onClick={() => inputRef.current?.click()} data-testid="th-import-pick"
              className="h-12 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
              <FileUp className="w-4 h-4" /> Excel Seç
            </button>
            {file && <div className="h-12 px-4 flex items-center text-slate-300 text-sm bg-slate-800/60 rounded-lg border border-slate-700 max-w-xs truncate">{file.name}</div>}
          </div>

          <div className="text-xs text-slate-500 bg-slate-800/40 border border-slate-700 rounded-lg p-3">
            <strong>Format:</strong> Başlık satırı zorunlu — <span className="font-mono text-slate-300">name, brand, type, length, diameter, min_stock, current_stock, location, note</span>. name zorunludur; (name + brand + type) ile eşleşen kayıt güncellenir, yoksa oluşturulur.
          </div>

          {loading && <div className="text-center py-10 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Önizleme hazırlanıyor...</div>}

          {stats && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3"><div className="text-xs text-slate-500 uppercase tracking-widest">Toplam</div><div className="text-2xl font-black font-mono-tab">{stats.total}</div></div>
              <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3"><div className="text-xs text-emerald-400 uppercase tracking-widest">Yeni</div><div className="text-2xl font-black font-mono-tab text-emerald-300">{stats.create}</div></div>
              <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-3"><div className="text-xs text-amber-400 uppercase tracking-widest">Güncelle</div><div className="text-2xl font-black font-mono-tab text-amber-300">{stats.update}</div></div>
              <div className="bg-red-50 border border-red-300 rounded-lg p-3"><div className="text-xs text-red-800 uppercase tracking-widest">Atlanan</div><div className="text-2xl font-black font-mono-tab text-red-900">{stats.skip}</div></div>
            </div>
          )}

          {preview && (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Satır</th>
                    <th className="px-3 py-2 text-left">İşlem</th>
                    <th className="px-3 py-2 text-left">Ad</th>
                    <th className="px-3 py-2 text-left">Marka</th>
                    <th className="px-3 py-2 text-left">Tip</th>
                    <th className="px-3 py-2 text-right">Boy</th>
                    <th className="px-3 py-2 text-right">Çap</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {preview.preview.map((p) => (
                    <tr key={p.row} className={p.action === "skip" ? "bg-red-950/20" : ""}>
                      <td className="px-3 py-2 font-mono-tab text-slate-500">{p.row}</td>
                      <td className="px-3 py-2">
                        {p.action === "create" && <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Yeni</span>}
                        {p.action === "update" && <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Güncelle</span>}
                        {p.action === "skip" && <span className="inline-flex items-center gap-1 text-red-800 text-xs font-bold uppercase" title={p.error}><AlertCircle className="w-3 h-3" /> Atla</span>}
                      </td>
                      <td className="px-3 py-2">{p.data.name || <span className="text-red-800 italic text-xs">{p.error}</span>}</td>
                      <td className="px-3 py-2 text-slate-400">{p.data.brand}</td>
                      <td className="px-3 py-2 text-slate-400">{p.data.type}</td>
                      <td className="px-3 py-2 text-right font-mono-tab">{p.data.length ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-mono-tab">{p.data.diameter ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-mono-tab">{p.data.current_stock ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="h-12 px-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100">İptal</button>
          <button onClick={commit} disabled={!preview || committing || (stats && stats.create + stats.update === 0)} data-testid="th-import-commit"
            className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold flex items-center gap-2">
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {stats ? `${stats.create + stats.update} Kaydı Uygula` : "İçe Aktar"}
          </button>
        </div>
      </div>
    </div>
  );
}
