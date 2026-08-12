import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Package, Loader2, X } from "lucide-react";

const currency = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v || 0);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: "", unit_price: "" }]);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(null);

  const load = async () => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    const [o, s, pr] = await Promise.all([
      api.get("/orders", { params: p }),
      api.get("/suppliers"),
      api.get("/products"),
    ]);
    setOrders(o.data); setSuppliers(s.data); setProducts(pr.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const resetForm = () => {
    setSupplierId(""); setDeliveryDate(""); setNote("");
    setItems([{ product_id: "", quantity: "", unit_price: "" }]);
  };

  const addItem = () => setItems([...items, { product_id: "", quantity: "", unit_price: "" }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const onProductChange = (i, pid) => {
    const p = products.find((x) => x.id === pid);
    updateItem(i, { product_id: pid, unit_price: p ? String(p.unit_price) : "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!supplierId) return toast.error("Tedarikçi seçin");
    const cleaned = items.filter((it) => it.product_id && parseFloat(it.quantity) > 0);
    if (cleaned.length === 0) return toast.error("En az bir kalem ekleyin");
    setSaving(true);
    try {
      await api.post("/orders", {
        supplier_id: supplierId,
        delivery_date: deliveryDate || null,
        note,
        items: cleaned.map((it) => ({
          product_id: it.product_id,
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.unit_price) || 0,
        })),
      });
      toast.success("Sipariş oluşturuldu");
      resetForm(); setShowForm(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setSaving(false);
  };

  const closeOrder = async (o) => {
    if (!window.confirm(`Sipariş "#${o.id.slice(0, 8)}" kapatılsın mı? Kalemler stoğa girecek.`)) return;
    setClosing(o.id);
    try {
      await api.post(`/orders/${o.id}/close`);
      toast.success("Sipariş kapatıldı ve stoğa işlendi");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setClosing(null);
  };

  const del = async (o) => {
    if (!window.confirm("Sipariş silinsin mi?")) return;
    try { await api.delete(`/orders/${o.id}`); toast.success("Silindi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const orderTotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Satın Alma</div>
          <h1 className="font-display text-4xl font-black">Siparişler</h1>
          <p className="text-slate-400 text-sm mt-1">{orders.length} sipariş</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} data-testid="order-add-btn"
          className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30">
          <Plus className="w-5 h-5" /> Yeni Sipariş
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter("")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${!statusFilter ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Tümü</button>
        <button onClick={() => setStatusFilter("open")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${statusFilter === "open" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Açık</button>
        <button onClick={() => setStatusFilter("closed")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${statusFilter === "closed" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Kapalı</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Yeni Sipariş</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tedarikçi</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} data-testid="ord-supplier" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                <option value="">-- Seçin --</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Teslim Tarihi</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kalemler</label>
              <button type="button" onClick={addItem} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /> Kalem Ekle</button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                  <div className="col-span-6">
                    <select value={it.product_id} onChange={(e) => onProductChange(i, e.target.value)} className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm">
                      <option value="">-- Ürün --</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2"><input type="number" step="0.01" min="0" placeholder="Miktar" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm font-mono-tab" /></div>
                  <div className="col-span-3"><input type="number" step="0.01" min="0" placeholder="Birim ₺" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm font-mono-tab" /></div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="p-2 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right text-sm text-slate-400">Toplam: <span className="font-bold font-mono-tab text-slate-100">{currency(orderTotal)}</span></div>
          </div>

          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Not</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} data-testid="ord-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Sipariş Oluştur
            </button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600">İptal</button>
          </div>
        </form>
      )}

      {orders.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-500">Sipariş yok.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-700">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${o.status === "open" ? "text-amber-400 bg-amber-500/10 border-amber-500/30" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"}`}>
                    {o.status === "open" ? "Açık" : "Kapalı"}
                  </span>
                  <div>
                    <div className="font-display font-bold">{o.supplier_name}</div>
                    <div className="text-xs text-slate-500 font-mono-tab">#{o.id.slice(0, 8)} • {new Date(o.created_at).toLocaleDateString("tr-TR")}
                      {o.delivery_date && ` • teslim: ${new Date(o.delivery_date).toLocaleDateString("tr-TR")}`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 uppercase tracking-widest">Tutar</div>
                    <div className="font-mono-tab font-bold text-emerald-400">{currency(o.total)}</div>
                  </div>
                  {o.status === "open" && (
                    <button onClick={() => closeOrder(o)} disabled={closing === o.id} data-testid={`ord-close-${o.id.slice(0,8)}`}
                      className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-1 disabled:opacity-50">
                      {closing === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Kapat & Stoğa İşle
                    </button>
                  )}
                  <button onClick={() => del(o)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="divide-y divide-slate-700">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between items-center px-5 py-2 text-sm">
                    <div><span className="font-mono-tab text-slate-500">{it.product_code}</span> <span className="text-slate-200">{it.product_name}</span></div>
                    <div className="flex gap-4 font-mono-tab">
                      <span className="text-slate-400">{it.quantity} × {currency(it.unit_price)}</span>
                      <span className="text-slate-100 font-bold w-28 text-right">{currency(it.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {o.note && <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-400">Not: {o.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
