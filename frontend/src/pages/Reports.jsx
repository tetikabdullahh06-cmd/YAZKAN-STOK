import { useState } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { FileDown, Loader2, Package, Users, Settings2 } from "lucide-react";

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const REPORT_TYPES = [
  { key: "by_product", label: "Ürün Bazlı", icon: Package, tone: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  { key: "by_personnel", label: "Personel Bazlı", icon: Users, tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { key: "by_machine", label: "Tezgah Bazlı", icon: Settings2, tone: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
];

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(isoDay(-365));
  const [dateTo, setDateTo] = useState(isoDay(0));
  const [reportType, setReportType] = useState("by_product");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const applyPreset = (days) => { setDateFrom(isoDay(-days)); setDateTo(isoDay(0)); };

  const run = async () => {
    setLoading(true);
    try {
      const r = await api.get("/reports/summary", { params: { date_from: dateFrom, date_to: dateTo } });
      setSummary(r.data);
    } catch { toast.error("Rapor alınamadı"); }
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

  const rows = summary?.[reportType] || [];
  const sorted = [...rows].sort((a, b) => (b.qty || 0) - (a.qty || 0));
  const active = REPORT_TYPES.find((t) => t.key === reportType);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Analiz</div>
          <h1 className="font-display text-4xl font-black">Raporlar</h1>
        </div>
        <button onClick={downloadExcel} disabled={downloading} data-testid="reports-excel"
          className="h-14 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-900/40 disabled:opacity-50">
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          Excel İndir
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Rapor Türü</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {REPORT_TYPES.map((t) => (
              <button key={t.key} onClick={() => setReportType(t.key)} data-testid={`rep-type-${t.key}`}
                className={`h-16 px-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                  reportType === t.key
                    ? `${t.tone} border-current`
                    : "bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}>
                <t.icon className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                <span className="font-semibold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => applyPreset(0)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Bugün</button>
          <button onClick={() => applyPreset(7)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 7 Gün</button>
          <button onClick={() => applyPreset(30)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 30 Gün</button>
          <button onClick={() => applyPreset(90)} className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Son 90 Gün</button>
          <button onClick={() => applyPreset(365)} className="h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white">Son 1 Yıl</button>
        </div>
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Başlangıç (en fazla 1 yıl geriye)</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="rep-from" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Bitiş</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="rep-to" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <button onClick={run} disabled={loading} data-testid="rep-run"
            className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Raporu Getir
          </button>
        </div>
      </div>

      {summary && (
        <div data-testid="rep-result" className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
            <active.icon className="w-5 h-5 text-blue-400" />
            <h3 className="font-display text-lg font-bold">{active.label}</h3>
            <div className="ml-auto text-xs text-slate-500">{sorted.length} kayıt</div>
          </div>
          {sorted.length === 0 ? (
            <div className="p-10 text-center text-slate-500">Seçili aralıkta çıkış hareketi yok.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">İsim</th>
                  <th className="px-6 py-3 text-right">Toplam Miktar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sorted.map((row, i) => (
                  <tr key={i} className="h-14 hover:bg-slate-700/40">
                    <td className="px-6 font-mono-tab text-slate-500">{i + 1}</td>
                    <td className="px-6 font-medium">{row.name}</td>
                    <td className="px-6 text-right font-mono-tab font-bold text-emerald-400">{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
