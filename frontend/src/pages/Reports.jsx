import { useState } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";

const currency = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v || 0);

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(isoDay(-30));
  const [dateTo, setDateTo] = useState(isoDay(0));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const applyPreset = (days) => {
    setDateFrom(isoDay(-days));
    setDateTo(isoDay(0));
  };

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.get("/reports/summary", { params: { date_from: dateFrom, date_to: dateTo } });
      setSummary(r.data);
    } catch (e) { toast.error("Rapor alınamadı"); }
    setLoading(false);
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("access_token");
      const r = await fetch(`${API}/reports/excel?date_from=${dateFrom}&date_to=${dateTo}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `rapor_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel indirildi");
    } catch { toast.error("Excel indirilemedi"); }
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Analiz</div>
          <h1 className="font-display text-4xl font-black">Raporlar</h1>
        </div>
        <button onClick={downloadExcel} disabled={downloading} data-testid="reports-excel"
          className="h-14 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/40 disabled:opacity-50">
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          Excel İndir
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => applyPreset(0)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Bugün</button>
          <button onClick={() => applyPreset(7)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 7 Gün</button>
          <button onClick={() => applyPreset(30)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 30 Gün</button>
          <button onClick={() => applyPreset(90)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 90 Gün</button>
        </div>
        <div className="flex gap-4 flex-wrap items-end">
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Başlangıç</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="rep-from" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Bitiş</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="rep-to" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <button onClick={run} disabled={loading} data-testid="rep-run"
            className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Raporu Getir
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[
            { title: "Ürün Bazlı", data: summary.by_product, testid: "rep-by-product" },
            { title: "Personel Bazlı", data: summary.by_personnel, testid: "rep-by-personnel" },
            { title: "Tezgah Bazlı", data: summary.by_machine, testid: "rep-by-machine" },
          ].map((s) => (
            <div key={s.title} data-testid={s.testid} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700"><h3 className="font-display text-lg font-bold">{s.title}</h3></div>
              <div className="divide-y divide-slate-700 max-h-[420px] overflow-auto">
                {s.data.length === 0 && <div className="p-6 text-slate-500 text-sm">Veri yok</div>}
                {s.data.sort((a, b) => b.total - a.total).map((row, i) => (
                  <div key={i} className="flex justify-between items-center px-6 py-3">
                    <div className="min-w-0"><div className="font-medium truncate">{row.name}</div><div className="text-xs text-slate-500 font-mono-tab">{row.qty} adet</div></div>
                    <div className="font-mono-tab font-bold text-emerald-400 whitespace-nowrap">{currency(row.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
