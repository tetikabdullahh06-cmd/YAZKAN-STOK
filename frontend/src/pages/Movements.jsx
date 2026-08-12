import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Movements() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    const p = {};
    if (type) p.type = type;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    const r = await api.get("/movements", { params: p });
    setItems(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Kayıtlar</div>
        <h1 className="font-display text-4xl font-black">Hareket Geçmişi</h1>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tip</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 min-w-[140px]">
            <option value="">Tümü</option><option value="in">Giriş</option><option value="out">Çıkış</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Başlangıç</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Bitiş</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
        </div>
        <button onClick={() => { setType(""); setDateFrom(""); setDateTo(""); }} className="h-12 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Temizle</button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3 text-right">Miktar</th>
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">Tezgah</th>
                <th className="px-4 py-3">Tedarikçi / Not</th>
                <th className="px-4 py-3">Kullanıcı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Hareket yok</td></tr>}
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-slate-700/40">
                  <td className="px-4 py-3 font-mono-tab text-slate-400 whitespace-nowrap">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${m.type === "in" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30"}`}>
                      {m.type === "in" ? "Giriş" : "Çıkış"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><div className="font-medium">{m.product_name}</div><div className="text-xs text-slate-500 font-mono-tab">{m.product_code}</div></td>
                  <td className="px-4 py-3 text-right font-mono-tab font-bold">{m.quantity}</td>
                  <td className="px-4 py-3 text-slate-300">{m.personnel_name || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{m.machine_name || "-"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{m.supplier || m.note || "-"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.user_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
