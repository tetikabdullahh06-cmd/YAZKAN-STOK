import { useEffect, useState } from "react";
import api from "@/lib/api";
import { AlertTriangle, Package } from "lucide-react";

export default function CriticalStock() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/products/critical").then((r) => setItems(r.data)); }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-red-400 uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Kritik Seviye
        </div>
        <h1 className="font-display text-4xl font-black">Kritik Stok</h1>
        <p className="text-slate-400 text-sm mt-1">{items.length} ürün minimum stoğun altında</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-10 flex flex-col items-center gap-3">
          <Package className="w-12 h-12 text-emerald-400" />
          <div className="font-display text-2xl font-bold text-emerald-300">Kritik stok yok</div>
          <div className="text-slate-400 text-sm">Tüm ürünler minimum seviyenin üzerinde.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p) => (
            <div key={p.id} data-testid={`critical-${p.code}`} className="bg-red-950/30 border border-red-800/50 rounded-2xl p-6 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-mono-tab text-xs text-red-300 uppercase tracking-widest">{p.code} • {p.category}</div>
                <div className="font-display text-xl font-bold mt-1 truncate">{p.name}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-red-400 font-mono-tab">{p.current_stock}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">/ min {p.min_stock} {p.unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
