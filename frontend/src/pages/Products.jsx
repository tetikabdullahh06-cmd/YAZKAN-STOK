import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";

const empty = { code: "", name: "", category: "Kesici Uç", unit: "adet", unit_price: 0, min_stock: 0, current_stock: 0 };
const DEFAULT_CATS = ["Kesici Uç", "Matkap", "Kater", "Apparat", "Ölçüm Aleti", "Diğer"];
const CATS_STORAGE_KEY = "cnc_extra_categories";

export default function Products() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [extraCats, setExtraCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CATS_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const load = () => api.get("/products").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const allCats = Array.from(new Set([
    ...DEFAULT_CATS,
    ...extraCats,
    ...items.map((p) => p.category).filter(Boolean),
  ]));

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!allCats.includes(c)) {
      const next = [...extraCats, c];
      setExtraCats(next);
      localStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(next));
    }
    setForm({ ...form, category: c });
    setNewCat(""); setShowNewCat(false);
    toast.success(`"${c}" kategorisi eklendi`);
  };

  const filtered = items.filter((p) => {
    const s = q.toLowerCase();
    return !s || p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      unit_price: parseFloat(form.unit_price) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
    };
    try {
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success(editId ? "Ürün güncellendi" : "Ürün eklendi");
      setShowForm(false); setEditId(null); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const edit = (p) => { setForm(p); setEditId(p.id); setShowForm(true); };
  const del = async (p) => {
    if (!window.confirm(`${p.name} silinsin mi?`)) return;
    try { await api.delete(`/products/${p.id}`); toast.success("Silindi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Katalog</div>
          <h1 className="font-display text-4xl font-black">Ürünler</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} ürün</p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }} data-testid="product-add-btn"
          className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30">
          <Plus className="w-5 h-5" /> Yeni Ürün
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="product-search"
            placeholder="Kod, isim veya kategori ara..."
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} data-testid="product-form" className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kod</label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="pf-code" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ad</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pf-name" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kategori</label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="pf-category" className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                  {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewCat(true)} data-testid="pf-add-cat" title="Yeni kategori ekle"
                  className="h-12 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/50 text-xl font-bold">+</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  data-testid="pf-new-cat" placeholder="Yeni kategori adı"
                  className="flex-1 h-12 bg-slate-950 border border-blue-500 rounded-lg px-3" />
                <button type="button" onClick={addCategory} data-testid="pf-save-cat" className="h-12 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Ekle</button>
                <button type="button" onClick={() => { setShowNewCat(false); setNewCat(""); }} className="h-12 px-3 rounded-lg bg-slate-700 hover:bg-slate-600">İptal</button>
              </div>
            )}
          </div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Birim</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Birim Fiyat (₺)</label>
            <input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} data-testid="pf-price" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Minimum Stok</label>
            <input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} data-testid="pf-min" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Mevcut Stok</label>
            <input type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} data-testid="pf-current" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-3 flex gap-3">
            <button type="submit" data-testid="pf-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-4 py-3">Kod</th><th className="px-4 py-3">Ad</th><th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Stok</th><th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-right">Fiyat</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((p) => {
                const crit = p.current_stock <= p.min_stock;
                return (
                  <tr key={p.id} data-testid={`product-row-${p.code}`} className={`h-16 hover:bg-slate-700/40 ${crit ? "bg-red-950/20" : ""}`}>
                    <td className="px-4 font-mono-tab font-semibold text-slate-300">{p.code}</td>
                    <td className="px-4 font-medium">{p.name}</td>
                    <td className="px-4 text-slate-400 text-sm">{p.category}</td>
                    <td className="px-4 text-right font-mono-tab font-bold">
                      <div className="inline-flex items-center gap-2">
                        {crit && <AlertTriangle className="w-4 h-4 text-red-400" />}
                        <span className={crit ? "text-red-400" : ""}>{p.current_stock} {p.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 text-right font-mono-tab text-slate-400">{p.min_stock}</td>
                    <td className="px-4 text-right font-mono-tab">{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(p.unit_price)}</td>
                    <td className="px-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => edit(p)} data-testid={`product-edit-${p.code}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(p)} data-testid={`product-delete-${p.code}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Ürün bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
