import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Package, AlertTriangle, Activity, History, Users, Settings2, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { Link } from "react-router-dom";

function KpiCard({ label, value, icon: Icon, tone = "blue", testid }) {
  const toneCls = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    red: "text-red-400 bg-red-500/10 border-red-500/30",
  }[tone];
  return (
    <div data-testid={testid} className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{label}</div>
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${toneCls}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
      </div>
      <div className="font-display text-4xl font-black tracking-tight font-mono-tab">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)).catch(() => {}); }, []);

  if (!d) return <div className="text-slate-400">Yükleniyor...</div>;

  const monthMovementCount = (d.top_personnel || []).reduce((s, p) => s + (p.qty || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Ana Panel</div>
        <h1 className="font-display text-4xl md:text-5xl font-black">Takımhane Genel Bakış</h1>
      </div>

      {/* Kritik stok uyarısı — ana panelde en üstte, çok belirgin (mail gönderilmiyor) */}
      {d.critical_products && d.critical_products.length > 0 && (
        <div data-testid="dashboard-critical-alert" className="relative bg-gradient-to-br from-red-950/60 via-red-900/40 to-red-950/60 border-2 border-red-500/50 rounded-2xl overflow-hidden shadow-lg shadow-red-950/40">
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent 0 12px, rgba(239,68,68,0.08) 12px 24px)" }} />
          <div className="relative px-6 py-4 border-b border-red-500/30 flex items-center gap-3 bg-red-500/10">
            <div className="w-11 h-11 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-300" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-red-300 uppercase tracking-[0.3em] font-bold">Acil Dikkat</div>
              <h3 className="font-display text-xl font-black text-red-100">Kritik Stok Uyarıları · {d.critical_products.length} kalem</h3>
            </div>
            <Link to="/kritik-stok" data-testid="dashboard-critical-view-all" className="hidden md:inline-flex h-10 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold items-center gap-2">
              Tümünü Gör
            </Link>
          </div>
          <div className="relative divide-y divide-red-900/40 max-h-80 overflow-auto">
            {d.critical_products.map((p) => (
              <div key={p.id} data-testid={`dashboard-critical-row-${p.code}`} className="flex items-center justify-between px-6 py-3 hover:bg-red-500/5">
                <div className="min-w-0">
                  <div className="font-mono-tab text-xs text-red-300">{p.code}</div>
                  <div className="font-semibold text-red-50 truncate">{p.name}</div>
                  {p.location && <div className="text-xs text-red-300/70">Konum: {p.location}</div>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-2xl font-black font-mono-tab text-red-300">{p.current_stock} <span className="text-sm text-red-400/60">/ {p.min_stock}</span></div>
                  <div className="text-[10px] text-red-300/70 uppercase tracking-wider">mevcut / min · {p.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div data-testid="dashboard-out-of-stock" className="relative bg-gradient-to-br from-rose-700/35 via-red-500/25 to-orange-400/25 border-2 border-rose-400/80 rounded-2xl overflow-hidden shadow-lg shadow-rose-900/30"><div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.12) 12px 24px)" }} /><div className="relative px-6 py-4 border-b border-rose-300/60 flex items-center gap-3 bg-rose-500/25"><div className="w-11 h-11 rounded-lg bg-red-500/40 border border-red-200/80 flex items-center justify-center"><Package className="w-6 h-6 text-white" /></div><div className="flex-1"><div className="text-[10px] text-white uppercase tracking-[0.3em] font-black">Acil Dikkat</div><h3 className="font-display text-xl font-black text-white">Stoğu Biten Ürünlerin Tam Listesi · {d.out_of_stock_products?.length || 0} kalem</h3></div><Link to="/urunler" className="hidden md:inline-flex h-10 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold items-center gap-2">Ürünleri Gör</Link></div>{(d.out_of_stock_products || []).length > 0 ? <div className="relative divide-y divide-rose-300/35 max-h-[32rem] overflow-y-scroll overflow-x-hidden bg-red-500/10" style={{ scrollbarWidth: "auto", scrollbarGutter: "stable" }}>{d.out_of_stock_products.map((p) => <div key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/10"><div className="min-w-0"><div className="font-mono-tab text-xs font-bold text-rose-100">{p.code}</div><div className="font-semibold text-white truncate">{p.name}</div>{p.location && <div className="text-xs text-rose-100/90 font-semibold">Konum: {p.location}</div>}</div><div className="text-right shrink-0 ml-4"><div className="text-2xl font-black font-mono-tab text-white">0 <span className="text-sm text-rose-100/90">/ {p.min_stock}</span></div><div className="text-[10px] text-white/90 uppercase tracking-wider font-bold">mevcut / min · {p.unit}</div></div></div>)}</div> : <div className="relative px-6 py-5 text-sm font-bold text-emerald-300">Stoğu tamamen biten ürün bulunmuyor.</div>}</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard label="Toplam Ürün" value={d.total_products} icon={Package} tone="blue" testid="kpi-total-products" />
        <KpiCard label="Kritik Stok" value={d.critical_count} icon={AlertTriangle} tone={d.critical_count > 0 ? "red" : "emerald"} testid="kpi-critical-count" />
        <KpiCard label="Aylık Hareket" value={d.recent_movements?.length || 0} icon={Activity} tone="emerald" testid="kpi-month-moves" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/stok-cikis" data-testid="quick-stock-out" className="bg-red-950/40 hover:bg-red-950/60 border border-red-800/50 rounded-2xl p-8 flex items-center gap-5 active:scale-[0.98] transition-all">
          <div className="w-16 h-16 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-950/40">
            <ArrowUpFromLine className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-2xl font-bold">Stok Çıkışı</div>
            <div className="text-slate-400 text-sm mt-1">Personel + tezgah ile hızlı çıkış</div>
          </div>
        </Link>
        <Link to="/stok-giris" data-testid="quick-stock-in" className="bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/50 rounded-2xl p-8 flex items-center gap-5 active:scale-[0.98] transition-all">
          <div className="w-16 h-16 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <ArrowDownToLine className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-2xl font-bold">Stok Girişi</div>
            <div className="text-slate-400 text-sm mt-1">Tedarikçi + miktar kaydet</div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <div><h3 className="font-display text-lg font-bold">Personel Listesi</h3><p className="text-xs text-slate-400 mt-1">Detay için personel adına tıklayın.</p></div>
          </div>
          <div className="divide-y divide-slate-700 max-h-96 overflow-auto">
            {(d.personnel_list || []).length === 0 && <div className="p-6 text-slate-500 text-sm">Personel kaydı yok</div>}
            {(d.personnel_list || []).map((p) => (
              <Link key={p.id} to={`/tuketim-detay/personel/${p.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-blue-500/10 transition-colors">
                <div><div className="font-medium">{p.name}</div><div className="text-xs text-slate-400">{p.department || "Departman belirtilmemiş"}</div></div>
                <div className="text-right"><div className="font-mono-tab font-bold text-emerald-400">{p.qty}</div><div className="text-[10px] text-slate-500">Bu ay</div></div>
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-400" />
            <div><h3 className="font-display text-lg font-bold">Tezgâh Listesi</h3><p className="text-xs text-slate-400 mt-1">Detay için tezgâha tıklayın.</p></div>
          </div>
          <div className="divide-y divide-slate-700 max-h-96 overflow-auto">
            {(d.machine_list || []).length === 0 && <div className="p-6 text-slate-500 text-sm">Tezgâh kaydı yok</div>}
            {(d.machine_list || []).map((m) => (
              <Link key={m.id} to={`/tuketim-detay/tezgah/${m.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-blue-500/10 transition-colors">
                <div><div className="font-medium">{m.code} — {m.name}</div><div className="text-xs text-slate-400">{m.brand || ""}{m.model ? ` · ${m.model}` : ""}</div></div>
                <div className="text-right"><div className="font-mono-tab font-bold text-emerald-400">{m.qty}</div><div className="text-[10px] text-slate-500">Bu ay</div></div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {d.critical_products.length > 0 && false && (
        <div className="bg-red-950/30 border border-red-800/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-800/50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="font-display text-lg font-bold text-red-300">Kritik Stok Uyarıları</h3>
          </div>
          <div className="divide-y divide-red-900/50">
            {d.critical_products.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <div className="font-mono-tab text-xs text-red-300">{p.code}</div>
                  <div className="font-medium">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 font-bold font-mono-tab">{p.current_stock} / {p.min_stock} {p.unit}</div>
                  <div className="text-xs text-slate-500">mevcut / min</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <h3 className="font-display text-lg font-bold">Son Hareketler</h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-6 py-3">Tarih</th>
                <th className="px-6 py-3">Tip</th>
                <th className="px-6 py-3">Ürün</th>
                <th className="px-6 py-3">Miktar</th>
                <th className="px-6 py-3">Personel/Tezgah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {d.recent_movements.length === 0 && <tr><td colSpan={5} className="p-6 text-slate-500">Henüz hareket yok</td></tr>}
              {d.recent_movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-6 py-3 font-mono-tab text-slate-400">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${m.type === "in" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30"}`}>
                      {m.type === "in" ? "Giriş" : "Çıkış"}
                    </span>
                  </td>
                  <td className="px-6 py-3"><div className="font-medium">{m.product_name}</div><div className="text-xs text-slate-500 font-mono-tab">{m.product_code}</div></td>
                  <td className="px-6 py-3 font-mono-tab font-bold">{m.quantity}</td>
                  <td className="px-6 py-3 text-slate-300">{m.personnel_name || "-"} {m.machine_name ? `/ ${m.machine_name}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
