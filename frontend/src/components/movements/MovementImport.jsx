import { useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { FileUp, FileDown, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseMovementWorkbook } from "@/lib/movementExcelParse";

const MODE_HINTS = {
  personnel: "Takım Sarfiyatı ve Eldiven Sarfiyatı sayfaları okunur. Tarih, Ürün Kodu/Adı, Miktar, Personel sütunları kullanılır.",
  stock: "Stok Hareketleri sayfası okunur. Tip (Giriş/Çıkış), Ürün Kodu/Adı, Miktar, Tarih, Personel sütunları kullanılır.",
  product: "Ürün hareketleri sayfası okunur. Tip (Giriş/Çıkış), Ürün Kodu/Adı, Miktar, Tarih sütunları kullanılır.",
  toolholder: "Takım tutucu hareketleri sayfası okunur. Tip (Giriş/Çıkış), Takım Tutucu Kodu/Adı, Miktar, Tarih sütunları kullanılır.",
};

export default function MovementImport({ mode, title, onClose, onDone }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    setLoading(true);
    setPreview(null);
    setRows([]);
    setSheets([]);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMovementWorkbook(buffer, mode);
      if (!parsed.rows.length) {
        toast.error("Dosyada okunabilir hareket satırı bulunamadı. Başlık satırında Tarih, Ürün Kodu/Adı ve Miktar olmalı.");
        setLoading(false);
        return;
      }
      setRows(parsed.rows);
      setSheets(parsed.sheets);
      const response = await api.post("/import/movements", { rows: parsed.rows, dry_run: true });
      setPreview(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || "Dosya okunamadı");
    }
    setLoading(false);
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  const commit = async () => {
    if (!rows.length) return;
    setCommitting(true);
    try {
      const response = await api.post("/import/movements", { rows, dry_run: false });
      const skipped = response.data.skipped?.length || 0;
      toast.success(`${response.data.created} hareket içe aktarıldı${skipped ? `, ${skipped} satır atlandı` : ""}`);
      onDone?.();
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "İçe aktarma başarısız");
    }
    setCommitting(false);
  };

  const planned = preview?.planned || [];
  const skipped = preview?.skipped || [];
  const readyCount = preview?.created || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">Excel İçe Aktar</div>
            <div className="font-display text-xl font-bold">{title}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex-1 overflow-auto space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
            <button onClick={() => inputRef.current?.click()}
              className="h-12 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
              <FileUp className="w-4 h-4" /> Excel Seç
            </button>
            <button onClick={() => toast.info("Dışa aktardığınız dosyayı düzenleyip buradan geri yükleyebilirsiniz; ayrı şablon gerekmez.")}
              className="h-12 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-2">
              <FileDown className="w-4 h-4" /> Şablon Bilgisi
            </button>
            {fileName && <div className="h-12 px-4 flex items-center text-slate-300 text-sm bg-slate-800/60 rounded-lg border border-slate-700 max-w-sm truncate">{fileName}</div>}
          </div>

          <div className="text-xs text-slate-400 bg-slate-800/40 border border-slate-700 rounded-lg p-3 leading-relaxed">
            {MODE_HINTS[mode]}
            <br />
            Kayıtlar <span className="text-slate-200 font-semibold">ürün/tutucu/eldiven adı veya kodu</span> ile eşleştirilir; bulunamayan satır atlanır.
            Aynı ürün, tip, miktar, tarih ve personel ile kayıtlı bir hareket varsa satır <span className="text-amber-300 font-semibold">mükerrer</span> sayılıp atlanır.
            Stok eksiye düşebilir (sayım düzeltmesi serbest).
          </div>

          {loading && <div className="text-center py-10 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Dosya okunuyor ve önizleme hazırlanıyor...</div>}

          {!loading && preview && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Okunan Satır</div>
                  <div className="text-2xl font-black font-mono-tab">{preview.total}</div>
                </div>
                <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3">
                  <div className="text-xs text-emerald-400 uppercase tracking-widest">Aktarılacak</div>
                  <div className="text-2xl font-black font-mono-tab text-emerald-300">{readyCount}</div>
                </div>
                <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3">
                  <div className="text-xs text-red-400 uppercase tracking-widest">Atlanan</div>
                  <div className="text-2xl font-black font-mono-tab text-red-300">{skipped.length}</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-widest">Sayfa</div>
                  <div className="text-sm font-semibold text-slate-200 truncate">{sheets.map((s) => `${s.name} (${s.count})`).join(", ") || "-"}</div>
                </div>
              </div>

              {skipped.length > 0 && (
                <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-3 space-y-1 max-h-40 overflow-auto">
                  <div className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Atlanan satırlar</div>
                  {skipped.slice(0, 60).map((item) => (
                    <div key={`skip-${item.row}`} className="text-xs text-red-200">
                      <span className="font-mono-tab text-red-400">Satır {item.row}:</span> {item.reason}
                    </div>
                  ))}
                  {skipped.length > 60 && <div className="text-xs text-red-300">… {skipped.length - 60} satır daha</div>}
                </div>
              )}

              {planned.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2 bg-slate-900/60"><CheckCircle2 className="w-4 h-4" /> Aktarılacak hareketler (ilk {planned.length})</div>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Satır</th>
                          <th className="px-3 py-2 text-left">Tip</th>
                          <th className="px-3 py-2 text-left">Tarih</th>
                          <th className="px-3 py-2 text-left">Kayıt</th>
                          <th className="px-3 py-2 text-right">Miktar</th>
                          <th className="px-3 py-2 text-left">Personel</th>
                          <th className="px-3 py-2 text-right">Stok (önce → sonra)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {planned.map((row) => (
                          <tr key={`plan-${row.row}`} className={row.stock_after < 0 ? "bg-amber-950/20" : ""}>
                            <td className="px-3 py-1.5 font-mono-tab text-slate-500">{row.row}</td>
                            <td className="px-3 py-1.5">
                              <span className={`text-xs font-bold uppercase ${row.type === "in" ? "text-emerald-400" : "text-amber-400"}`}>{row.type === "in" ? "Giriş" : "Çıkış"}</span>
                            </td>
                            <td className="px-3 py-1.5 font-mono-tab text-slate-300">{row.date}</td>
                            <td className="px-3 py-1.5 text-slate-200">{row.name}</td>
                            <td className="px-3 py-1.5 text-right font-mono-tab font-bold">{row.quantity}</td>
                            <td className="px-3 py-1.5 text-slate-400">{row.personnel_name || "-"}</td>
                            <td className={`px-3 py-1.5 text-right font-mono-tab ${row.stock_after < 0 ? "text-red-300 font-bold" : "text-slate-300"}`}>{row.stock_before} → {row.stock_after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="h-12 px-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100">İptal</button>
          <button onClick={commit} disabled={!rows.length || committing || readyCount === 0}
            className="h-12 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-2">
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {readyCount ? `${readyCount} Hareketi Kaydet` : "İçe Aktar"}
          </button>
        </div>
      </div>
    </div>
  );
}
