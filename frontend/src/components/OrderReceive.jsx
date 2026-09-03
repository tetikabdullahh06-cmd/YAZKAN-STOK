import { useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, Loader2, PackageCheck } from "lucide-react";

export default function OrderReceive({ order, onClose, onReceived }) {
  const initial = order.items.map((it) => ({
    key: it.toolholder_id || it.product_id || it.product_code || it.product_name,
    qty: String(Math.max(0, (it.quantity || 0) - (it.received_qty || 0))),
  }));
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = (i, qty) => setRows(rows.map((r, idx) => idx === i ? { ...r, qty } : r));

  const submit = async () => {
    const items = rows
      .map((r, i) => {
        const it = order.items[i];
        return { kind: it.kind === "toolholder" ? "toolholder" : "product", item_id: it.toolholder_id || it.product_id || it.product_code || it.product_name, product_id: it.product_id || it.product_code || it.product_name, quantity: parseFloat(r.qty) || 0 };
      })
      .filter((r) => r.quantity > 0);
    if (items.length === 0) return toast.error("En az bir kalem için teslim miktarı girin");
    setSaving(true);
    try {
      await api.post(`/orders/${order.id}/receive`, { items });
      toast.success("Teslimat kaydedildi");
      onReceived?.();
      onClose?.();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <div className="text-xs text-emerald-400 uppercase tracking-[0.2em] font-semibold">Kısmi Teslimat</div>
            <div className="font-display text-xl font-bold">{order.supplier_name}</div>
            <div className="text-xs text-slate-500 font-mono-tab">Sipariş #{order.id.slice(0, 8)}</div>
          </div>
          <button onClick={onClose} data-testid="receive-close" className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <div className="text-xs text-slate-500 bg-slate-800/40 border border-slate-700 rounded-lg p-3 mb-4">
            Her kalem için bugün <strong>teslim aldığınız</strong> miktarı girin. Varsayılan olarak kalan miktar önerilir. Almayacaklarınıza 0 yazın. Tüm kalemler tamamlanınca sipariş otomatik kapanır. Manuel eklenen ürünler stokta yoksa otomatik oluşturulur.
          </div>

          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Ürün</th>
                  <th className="px-3 py-2 text-right">Sipariş</th>
                  <th className="px-3 py-2 text-right">Alınan</th>
                  <th className="px-3 py-2 text-right">Kalan</th>
                  <th className="px-3 py-2 text-right">Şimdi Al</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {order.items.map((it, i) => {
                  const remaining = (it.quantity || 0) - (it.received_qty || 0);
                  const done = remaining <= 0;
                  return (
                    <tr key={i} className={done ? "opacity-50" : ""}>
                      <td className="px-3 py-2">
                        <div className="font-medium flex items-center gap-2">
                          {it.kind === "toolholder" ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30">Takım Tutucu</span> : it.manual && !it.product_id && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 border border-blue-500/30">Manuel</span>}
                          {it.product_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-tab">{it.product_code || "-"}{it.kind === "toolholder" ? " • Tutucu stoğuna girecek" : " • Ürün stoğuna girecek"}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tab">{it.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono-tab text-emerald-400">{it.received_qty || 0}</td>
                      <td className="px-3 py-2 text-right font-mono-tab text-amber-400 font-bold">{remaining}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" max={remaining} step="0.01"
                          value={rows[i].qty} disabled={done}
                          onChange={(e) => update(i, e.target.value)}
                          data-testid={`receive-qty-${i}`}
                          className="w-24 h-10 bg-slate-950 border border-slate-700 rounded-lg px-2 text-right font-mono-tab font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-40" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="h-12 px-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100">İptal</button>
          <button onClick={submit} disabled={saving} data-testid="receive-submit"
            className="h-12 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
            Teslimatı Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
