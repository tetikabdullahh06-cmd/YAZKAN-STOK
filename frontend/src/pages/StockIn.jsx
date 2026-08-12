import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowDownToLine, Loader2 } from "lucide-react";

export default function StockIn() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)); }, []);

  const selected = products.find((p) => p.id === productId);

  const submit = async (e) => {
    e.preventDefault();
    if (!productId) return toast.error("Ürün seçiniz");
    setLoading(true);
    try {
      const r = await api.post("/stock/in", {
        product_id: productId,
        quantity: parseFloat(quantity),
        unit_price: unitPrice ? parseFloat(unitPrice) : null,
        supplier, note,
      });
      toast.success(`Stok girişi kaydedildi. Yeni stok: ${r.data.new_stock}`);
      setProductId(""); setQuantity(""); setUnitPrice(""); setSupplier(""); setNote("");
      api.get("/products").then((r) => setProducts(r.data));
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-emerald-400 uppercase tracking-[0.2em] font-semibold mb-2">Depoya Kaydet</div>
        <h1 className="font-display text-4xl font-black">Stok Girişi</h1>
        <p className="text-slate-400 text-sm mt-1">Depoya yeni gelen malzemeleri kaydedin.</p>
      </div>

      <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ürün</label>
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} data-testid="si-product"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">-- Ürün seçin --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name} (Mevcut: {p.current_stock} {p.unit})</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Miktar {selected ? `(${selected.unit})` : ""}</label>
            <input required type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="si-qty"
              className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-lg font-bold font-mono-tab focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Birim Fiyat (₺) — opsiyonel</label>
            <input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} data-testid="si-price"
              placeholder={selected ? String(selected.unit_price) : ""}
              className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-lg font-mono-tab focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tedarikçi</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} data-testid="si-supplier"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Açıklama</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>

        <button type="submit" disabled={loading} data-testid="si-submit"
          className="w-full h-16 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-900/40">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowDownToLine className="w-6 h-6" />}
          Girişi Kaydet
        </button>
      </form>
    </div>
  );
}
