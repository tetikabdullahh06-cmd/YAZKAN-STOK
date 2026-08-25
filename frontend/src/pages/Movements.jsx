import { useEffect, useState } from "react";
import api from "@/lib/api";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { toast } from "sonner";

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
    const rawItems = Array.isArray(r.data) ? r.data : [];
    const isSharpening = (m) => Boolean(
      m.movement_category === "Bilemeye Giden" ||
      m.movement_category === "Bilemeden Gelen" ||
      m.sharpening_record_id ||
      String(m.movement_purpose || "").toLocaleLowerCase("tr-TR").includes("bileme")
    );
    const keyOf = (m) => [
      m.type || "", m.product_code || m.product_id || m.product_name || "",
      Number(m.quantity || 0), String(m.transaction_date || m.created_at || "").slice(0, 10),
    ].join("|");
    const sharpeningKeys = new Set(rawItems.filter(isSharpening).map(keyOf));
    const seen = new Set();
    const seenSharpening = new Set();
    const cleanItems = rawItems.filter((m) => {
      const key = keyOf(m);
      // Aynı ürün/miktar/tarihte bileme hareketi varsa normal işleme çıkışını kaldır.
      if (!isSharpening(m) && sharpeningKeys.has(key)) return false;
      // Aynı bileme hareketi canlı eski API’den birden fazla gelirse tek satır bırak.
      if (isSharpening(m)) {
        const sharpeningKey = `${key}|${m.movement_category || (m.type === "in" ? "Bilemeden Gelen" : "Bilemeye Giden")}`;
        if (seenSharpening.has(sharpeningKey)) return false;
        seenSharpening.add(sharpeningKey);
      }
      const uniqueKey = `${m.id || key}|${m.type || ""}`;
      if (seen.has(uniqueKey)) return false;
      seen.add(uniqueKey);
      return true;
    });
    setItems(cleanItems);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, dateFrom, dateTo]);

  const exportExcel = () => {
    if (!items.length) return toast.info("Dışa aktarılacak hareket bulunamadı");
    const rows = items.map((m) => ({
      "İşlem Tarihi": m.transaction_date || (m.created_at ? new Date(m.created_at).toLocaleString("tr-TR") : ""),
      "Tip": m.type === "in" ? "Giriş" : "Çıkış",
      "İşlem / Amaç": m.movement_category || (m.sharpening_record_id ? (m.type === "in" ? "Bilemeden Gelen" : "Bilemeye Giden") : (m.type === "in" ? "Stok Girişi" : "İşleme İçin Verildi")),
      "Hedef": m.destination || m.machine_name || m.supplier || "",
      "Ürün Kodu": m.product_code || "",
      "Ürün Adı": m.product_name || "",
      "Miktar": m.quantity ?? 0,
      "Personel": m.personnel_name || "",
      "Tezgâh Kodu": m.machine_code || "",
      "Tezgâh Adı": m.machine_name || "",
      "Takım Tutucu Kodu": m.toolholder_code || "",
      "Takım Tutucu": m.toolholder_name || "",
      "Üretim / İşlenen Ürün": m.production_product || "",
      "Tedarikçi": m.supplier || "",
      "Not": m.note || "",
      "Kullanıcı": m.user_name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0]);
    ws["!autofilter"] = { ref: `A1:P${rows.length + 1}` };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, Math.min(32, h.length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hareketler");
    XLSX.writeFile(wb, `hareketler-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} hareket Excel'e aktarıldı`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Kayıtlar</div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-display text-4xl font-black">Hareket Geçmişi</h1>
          <button onClick={exportExcel} data-testid="movements-export" className="h-12 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-2"><Download className="w-5 h-5" /> Excel’e Aktar</button>
        </div>
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
                <th className="px-4 py-3">İşlem / Amaç</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3 text-right">Miktar</th>
                <th className="px-4 py-3">Personel</th>
                <th className="px-4 py-3">Tezgah</th>
                <th className="px-4 py-3">Tedarikçi / Not</th>
                <th className="px-4 py-3">Kullanıcı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">Hareket yok</td></tr>}
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-slate-700/40">
                  <td className="px-4 py-3 font-mono-tab text-slate-400 whitespace-nowrap">{m.transaction_date ? new Date(`${m.transaction_date}T12:00:00`).toLocaleDateString("tr-TR") : new Date(m.created_at).toLocaleString("tr-TR")}</td>
                                    <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${m.movement_category === "Bilemeye Giden" ? "text-rose-700 bg-rose-100 border-rose-300" : m.movement_category === "Bilemeden Gelen" ? "text-emerald-700 bg-emerald-100 border-emerald-300" : m.type === "in" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30"}`}>
                      {m.movement_category || (m.type === "in" ? "Giriş" : "Çıkış")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{m.movement_category || (m.sharpening_record_id ? (m.type === "in" ? "Bilemeden Gelen" : "Bilemeye Giden") : (m.movement_purpose || (m.type === "in" ? "Stok Girişi" : "İşleme İçin Verildi")))}</td>
                  <td className="px-4 py-3"><div className="font-medium">{m.product_name}</div>
<div className="text-xs text-slate-500 font-mono-tab">{m.product_code}</div></td>
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
