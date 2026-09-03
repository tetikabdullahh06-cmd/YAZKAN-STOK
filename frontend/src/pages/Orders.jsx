import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Package, Loader2, X, PackageCheck, Pencil } from "lucide-react";
import OrderReceive from "@/components/OrderReceive";
import { useAuth } from "@/context/AuthContext";

// Item mode: 'select' = pick from products list; 'manual' = type product info by hand
const emptyItem = { mode: "select", kind: "product", product_id: "", toolholder_id: "", product_code: "", product_name: "", category: "Diğer", unit: "adet", quantity: "" };

export default function Orders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [toolholders, setToolholders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(null);
  const [receiveOrder, setReceiveOrder] = useState(null);

  const load = async () => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    const [o, s, pr, th] = await Promise.all([
      api.get("/orders", { params: p }),
      api.get("/suppliers"),
      api.get("/products"),
      api.get("/toolholders"),
    ]);
    setOrders(o.data); setSuppliers(s.data); setProducts(pr.data); setToolholders(th.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const resetForm = () => {
    setSupplierId(""); setDeliveryDate(""); setNote("");
    setItems([{ ...emptyItem }]);
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, patch) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const onProductChange = (i, pid) => updateItem(i, { product_id: pid, toolholder_id: "" });
  const onToolholderChange = (i, tid) => updateItem(i, { toolholder_id: tid, product_id: "" });
  const toggleKind = (i, kind) => updateItem(i, { kind, product_id: "", toolholder_id: "", product_code: "", product_name: "" });

  const openEdit = (order) => {
    if (order.status === "closed") return toast.error("Kapalı sipariş düzenlenemez");
    setEditingOrder(order);
    setSupplierId(order.supplier_id || "");
    setDeliveryDate(order.delivery_date || "");
    setNote(order.note || "");
    setItems((order.items || []).map((it) => ({
      ...emptyItem,
      mode: it.manual ? "manual" : "select",
      kind: it.kind === "toolholder" ? "toolholder" : "product",
      product_id: it.product_id || "",
      toolholder_id: it.toolholder_id || "",
      product_code: it.product_code || "",
      product_name: it.product_name || "",
      category: it.category || "Diğer",
      unit: it.unit || "adet",
      quantity: it.quantity || "",
    })));
    setShowForm(true);
  };

  const toggleMode = (i) => {
    const it = items[i];
    if (it.mode === "select") updateItem(i, { mode: "manual", product_id: "", toolholder_id: "", kind: "product" });
    else updateItem(i, { mode: "select", product_code: "", product_name: "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!supplierId) return toast.error("Tedarikçi seçin");
    const cleaned = [];
    for (const it of items) {
      const qty = parseFloat(it.quantity);
      if (!qty || qty <= 0) continue;
      if (it.mode === "select") {
        if (it.kind === "toolholder") {
          if (!it.toolholder_id) continue;
          cleaned.push({ kind: "toolholder", toolholder_id: it.toolholder_id, quantity: qty });
        } else {
          if (!it.product_id) continue;
          cleaned.push({ kind: "product", product_id: it.product_id, quantity: qty });
        }
      } else {
        const name = (it.product_name || "").trim();
        if (!name) { toast.error("Manuel kalem için ürün adı gerekli"); return; }
        cleaned.push({
          kind: "product", product_id: null,
          product_code: (it.product_code || "").trim(),
          product_name: name,
          category: it.category || "Diğer",
          unit: it.unit || "adet",
          quantity: qty,
        });
      }
    }
    if (cleaned.length === 0) return toast.error("En az bir kalem ekleyin");
    setSaving(true);
    try {
      const payload = { supplier_id: supplierId, delivery_date: deliveryDate || null, note, items: cleaned };
      if (editingOrder) await api.put(`/orders/${editingOrder.id}`, payload);
      else await api.post("/orders", payload);
      toast.success(editingOrder ? "Sipariş güncellendi" : "Sipariş oluşturuldu");
      resetForm(); setEditingOrder(null); setShowForm(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setSaving(false);
  };

  const closeOrder = async (o) => {
    if (!window.confirm(`Sipariş "#${o.id.slice(0, 8)}" kapatılsın mı? Kalan kalemler stoğa girecek.`)) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Satın Alma</div>
          <h1 className="font-display text-4xl font-black">Siparişler</h1>
          <p className="text-slate-400 text-sm mt-1">{orders.length} sipariş</p>
        </div>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowForm(true); }} data-testid="order-add-btn"
            className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-900/30">
            <Plus className="w-5 h-5" /> Yeni Sipariş
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter("")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${!statusFilter ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Tümü</button>
        <button onClick={() => setStatusFilter("open")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${statusFilter === "open" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Açık</button>
        <button onClick={() => setStatusFilter("partial")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${statusFilter === "partial" ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Kısmi</button>
        <button onClick={() => setStatusFilter("closed")} className={`h-10 px-4 rounded-lg text-sm font-semibold ${statusFilter === "closed" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>Kapalı</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">{editingOrder ? "Sipariş Düzelt" : "Yeni Sipariş"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tedarikçi</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} data-testid="ord-supplier" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                <option value="">-- Seçin --</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Teslim Tarihi</label>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kalemler</label>
              <button type="button" onClick={addItem} className="h-9 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4" /> Kalem Ekle</button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-slate-950 border border-slate-700 rounded-lg p-0.5">
                      <button type="button" onClick={() => it.mode !== "select" && toggleMode(i)}
                        className={`h-8 px-3 rounded-md text-xs font-semibold ${it.mode === "select" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                        Kayıtlı Ürün
                      </button>
                      <button type="button" onClick={() => it.mode !== "manual" && toggleMode(i)}
                        className={`h-8 px-3 rounded-md text-xs font-semibold ${it.mode === "manual" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                        Manuel Gir
                      </button>
                    </div>
                    <div className="ml-auto">
                      <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="p-2 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {it.mode === "select" ? (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => toggleKind(i, "product")} className={`h-9 px-3 rounded-lg text-xs font-bold ${it.kind === "product" ? "bg-blue-600 text-white" : "bg-slate-950 text-slate-400 border border-slate-700"}`}>Normal Ürün</button>
                        <button type="button" onClick={() => toggleKind(i, "toolholder")} className={`h-9 px-3 rounded-lg text-xs font-bold ${it.kind === "toolholder" ? "bg-amber-600 text-white" : "bg-slate-950 text-slate-400 border border-slate-700"}`}>Takım Tutucu</button>
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-9">
                          {it.kind === "toolholder" ? (
                            <select value={it.toolholder_id} onChange={(e) => onToolholderChange(i, e.target.value)} className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm">
                              <option value="">-- Takım Tutucu --</option>
                              {toolholders.map((h) => <option key={h.id} value={h.id}>{h.code || "Kodsuz"} — {h.name}{h.brand ? ` • ${h.brand}` : ""}</option>)}
                            </select>
                          ) : (
                            <select value={it.product_id} onChange={(e) => onProductChange(i, e.target.value)} className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm">
                              <option value="">-- Ürün --</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}{p.brand ? ` • ${p.brand}` : ""}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="col-span-3">
                          <input type="number" step="0.01" min="0" placeholder="Miktar" value={it.quantity}
                            onChange={(e) => updateItem(i, { quantity: e.target.value })}
                            className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm font-mono-tab" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <input placeholder="Kod (opsiyonel)" value={it.product_code}
                          onChange={(e) => updateItem(i, { product_code: e.target.value })}
                          className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm font-mono-tab" />
                      </div>
                      <div className="col-span-5">
                        <input placeholder="Ürün adı" value={it.product_name}
                          onChange={(e) => updateItem(i, { product_name: e.target.value })}
                          className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <input placeholder="Birim" value={it.unit}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                          className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" step="0.01" min="0" placeholder="Miktar" value={it.quantity}
                          onChange={(e) => updateItem(i, { quantity: e.target.value })}
                          className="w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-2 text-sm font-mono-tab" />
                      </div>
                      <div className="col-span-12 text-xs text-slate-500">
                        <span className="text-blue-300">ⓘ</span> Bu ürün stokta yoksa, sipariş kapatıldığında otomatik oluşturulur ve gelen miktar stoğa eklenir.
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Not</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} data-testid="ord-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editingOrder ? "Siparişi Güncelle" : "Sipariş Oluştur"}
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
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    o.status === "open" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    : o.status === "partial" ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  }`}>
                    {o.status === "open" ? "Açık" : o.status === "partial" ? "Kısmi" : "Kapalı"}
                  </span>
                  <div>
                    <div className="font-display font-bold">{o.supplier_name}</div>
                    <div className="text-xs text-slate-500 font-mono-tab">
                      #{o.id.slice(0, 8)} • {new Date(o.created_at).toLocaleDateString("tr-TR")}
                      {o.delivery_date && ` • teslim: ${new Date(o.delivery_date).toLocaleDateString("tr-TR")}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && o.status !== "closed" && (
                    <>
                      <button onClick={() => setReceiveOrder(o)} data-testid={`ord-receive-${o.id.slice(0,8)}`}
                        className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-1">
                        <PackageCheck className="w-4 h-4" /> Teslimat Al
                      </button>
                      <button onClick={() => closeOrder(o)} disabled={closing === o.id} data-testid={`ord-close-${o.id.slice(0,8)}`}
                        className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-1 disabled:opacity-50">
                        {closing === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Tamamını Kapat
                      </button>
                    </>
                  )}
                  {isAdmin && o.status !== "closed" && (
                    <button onClick={() => openEdit(o)} data-testid={`ord-edit-${o.id.slice(0,8)}`} title="Siparişi düzelt" className="p-2 rounded-lg hover:bg-blue-100 text-slate-400 hover:text-blue-700"><Pencil className="w-4 h-4" /></button>
                  )}
                  {isAdmin && (
                    <button onClick={() => del(o)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-700">
                {o.items.map((it, i) => {
                  const rec = it.received_qty || 0;
                  const remaining = (it.quantity || 0) - rec;
                  return (
                    <div key={i} className="flex justify-between items-center px-5 py-2 text-sm gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        {it.kind === "toolholder" ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30">Takım Tutucu</span> : it.manual && !it.product_id && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 border border-blue-500/30">Manuel</span>}
                        <span className="font-mono-tab text-slate-500">{it.product_code || "-"}</span>
                        <span className="text-slate-200">{it.product_name}</span>
                      </div>
                      <div className="flex gap-4 items-center font-mono-tab shrink-0">
                        <span className="text-slate-400 text-xs">{it.quantity} {it.unit || "adet"}</span>
                        {rec > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${remaining <= 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-blue-400 bg-blue-500/10 border-blue-500/30"}`}>
                            {remaining <= 0 ? "✓ Alındı" : `${rec}/${it.quantity} alındı`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {o.note && <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-400">Not: {o.note}</div>}
            </div>
          ))}
        </div>
      )}
      {receiveOrder && (
        <OrderReceive order={receiveOrder} onClose={() => setReceiveOrder(null)} onReceived={load} />
      )}
    </div>
  );
}
