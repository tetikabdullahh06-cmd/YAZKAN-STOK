import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Minus, Pencil, Trash2, Search, AlertTriangle, FileSpreadsheet, Wand2 } from "lucide-react";
import ProductImport from "@/components/ProductImport";
import { useAuth } from "@/context/AuthContext";

const emptyForm = { code: "", name: "", category: "Kesici Uç", unit: "adet", min_stock: 0, current_stock: 0, location: "", quality: "", brand: "", is_special: false };
const DEFAULT_CATS = ["Kesici Uç", "Matkap", "Kater", "Apparat", "Ölçüm Aleti", "Diğer"];
const CATS_STORAGE_KEY = "cnc_extra_categories";

export default function Products() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [extraCats, setExtraCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CATS_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [stockAdd, setStockAdd] = useState({ query: "", productId: "", quantity: "" });
  const [quickStock, setQuickStock] = useState({ productId: "", direction: "in", quantity: "", note: "" });

  const load = () => api.get("/products").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  
  const exportExcel = () => {
    if (!filtered.length) {
      toast.info("Dışa aktarılacak ürün bulunamadı");
      return;
    }

    const rows = filtered.map((p) => ({
      "Kod": p.code || "",
      "Ürün Adı": p.name || "",
      "Kategori": p.category || "",
      "Birim": p.unit || "",
      "Marka": p.brand || "",
      "Kalite": p.quality || "",
      "Konum": p.location || "",
      "Minimum Stok": p.min_stock ?? 0,
      "Mevcut Stok": p.current_stock ?? 0,
      "Bilemede": p.in_sharpening ?? 0,
      "Özel Takım": p.is_special ? "Evet" : "Hayır",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ürünler");
    XLSX.writeFile(workbook, `YAZKAN-urunler-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} ürün Excel dosyasına aktarıldı`);
  };

  const downloadImportTemplate = () => {
    const rows = [
      { code: "", name: "Örnek Kesici Uç", category: "Kesici Uç", unit: "adet", brand: "Örnek Marka", quality: "P25", location: "A-01", min_stock: 2, current_stock: 10, is_special: "Hayır" },
      { code: "MEVCUT_ÜRÜN_KODU", name: "Mevcut ürüne stok ekleme", category: "Kesici Uç", unit: "adet", brand: "Aynı marka", quality: "Aynı kalite", location: "", min_stock: "", current_stock: 5, is_special: "Hayır" },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ürün Şablonu");
    XLSX.writeFile(workbook, "urunler-ice-aktarma-sablonu.xlsx");
    toast.success("Ürün içe aktarma şablonu indirildi");
  };

  const allCats = Array.from(new Set([...DEFAULT_CATS, ...extraCats, ...items.map((p) => p.category).filter(Boolean)]));

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

  const existingMatches = items.filter((p) => { const s = stockAdd.query.toLowerCase().trim(); return !s || `${p.code || ""} ${p.name || ""} ${p.brand || ""} ${p.quality || ""}`.toLowerCase().includes(s); });

  const addExistingStock = async () => {
    const qty = Number(stockAdd.quantity);
    if (!stockAdd.productId) return toast.error("Önce stoktaki ürünü seçin");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Eklenecek adet 0'dan büyük olmalıdır");
    try {
      const r = await api.post("/stock/in", { product_id: stockAdd.productId, quantity: qty, supplier: "Ürünler sayfası stok artırma" });
      toast.success(`Stok artırıldı. Yeni stok: ${r.data.new_stock}`);
      setStockAdd({ query: "", productId: "", quantity: "" });
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Stok artırılamadı"); }
  };

  const quickAdjust = async (e, productId) => {
    e.preventDefault();
    const qty = Number(quickStock.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Miktar 0'dan büyük olmalıdır");
    try {
      const r = await api.post(`/products/${productId}/quick-stock`, { quantity: qty, direction: quickStock.direction, note: quickStock.note || "Ürünler sayfası hızlı stok işlemi" });
      toast.success(`${quickStock.direction === "in" ? "Stok artırıldı" : "Stok eksiltildi"}. Yeni stok: ${r.data.new_stock}`);
      setQuickStock({ productId: "", direction: "in", quantity: "", note: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hızlı stok işlemi yapılamadı"); }
  };

  const filtered = items.filter((p) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    // "özel takım" araması ~ tüm özel takımları getir
    const normalized = s.replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g");
    if (["ozel", "ozel takim", "özel", "özel takım", "special"].some((k) => normalized.includes(k))) {
      if (p.is_special) return true;
    }
    return (p.code || "").toLowerCase().includes(s) || p.name.toLowerCase().includes(s)
      || (p.category || "").toLowerCase().includes(s) || (p.location || "").toLowerCase().includes(s)
      || (p.brand || "").toLowerCase().includes(s) || (p.quality || "").toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!editId) {
      const duplicate = items.find((p) => (p.name || "").trim().toLowerCase() === form.name.trim().toLowerCase());
      if (duplicate) { toast.error("Bu isimde ürün zaten var. Mevcut ürüne adet ekleme panelini kullanın."); return; }
    }
    const payload = {
      ...form,
      min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      is_special: !!form.is_special,
    };
    try {
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success(editId ? "Ürün güncellendi" : "Ürün eklendi");
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const edit = (p) => { setForm({ ...emptyForm, ...p }); setEditId(p.id); setShowForm(true); };
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
        <div className="flex gap-3 flex-wrap">
          {isAdmin && (
            <>
              <button onClick={() => { setForm(emptyForm); setEditId(null); setStockAdd({ query: "", productId: "", quantity: "" }); setShowForm(true); }} data-testid="product-add-btn"
                className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-900/30">
                <Plus className="w-5 h-5" /> Yeni Ürün
              </button>
              <button onClick={() => setShowImport(true)} data-testid="product-import-btn"
                className="h-14 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2 active:scale-95">
                <FileSpreadsheet className="w-5 h-5" /> Excel'den İçe Aktar
              </button>
              <button onClick={downloadImportTemplate} data-testid="product-import-template-btn"
                className="h-14 px-5 rounded-lg bg-slate-800/70 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2 active:scale-95">
                <FileSpreadsheet className="w-5 h-5" /> Örnek İçe Aktar Şablonu
              </button>
        </>
      )}
      <button
        onClick={exportExcel}
        data-testid="product-export-btn"
        className="h-14 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white font-semibold flex items-center gap-2 active:scale-95"
      >
        <FileSpreadsheet className="w-5 h-5" /> Excel'e Dışa Aktar
            </button>
    </div>
  </div>


      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="product-search"
          placeholder="Kod, isim, kategori, konum, marka, kalite ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-2xl p-6 space-y-4">
          <div><div className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Mevcut stok kartına ekle</div><p className="text-sm text-slate-400 mt-1">Ürün zaten kayıtlıysa yeni kart oluşturma; ürünü seçip yalnızca eklenecek adedi gir.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={stockAdd.query} onChange={(e) => setStockAdd({ ...stockAdd, query: e.target.value, productId: "" })} placeholder="Kod, ürün adı, marka veya kalite ara..." className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
            <select value={stockAdd.productId} onChange={(e) => setStockAdd({ ...stockAdd, productId: e.target.value })} className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3"><option value="">Stoktaki ürünü seçin</option>{existingMatches.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name} | Marka: {p.brand || "Marka yok"} | Kalite: {p.quality || "-"} | Mevcut: {p.current_stock}</option>)}</select>
            <input type="number" min="0.01" step="0.01" value={stockAdd.quantity} onChange={(e) => setStockAdd({ ...stockAdd, quantity: e.target.value })} placeholder="Eklenecek adet" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div className="flex gap-3"><button type="button" onClick={addExistingStock} className="h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold">Adedi Stoka Ekle</button><span className="text-xs text-slate-500 self-center">Ürün bulunamazsa aşağıdaki yeni stok kartı formunu kullan.</span></div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} data-testid="product-form" className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 bg-blue-950/30 border border-blue-800/40 rounded-lg p-3 flex items-center gap-2 text-xs">
            <Wand2 className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300">Kod boş bırakılırsa otomatik atanır: <span className="font-mono-tab font-bold text-blue-300">YZK00001</span> formatında.</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kod (opsiyonel)</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="pf-code" placeholder="Otomatik"
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 font-mono-tab" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ad</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pf-name" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kategori</label>
            {!showNewCat ? (
              <div className="flex gap-2">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="pf-category" className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                  {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewCat(true)} data-testid="pf-add-cat" title="Yeni kategori"
                  className="h-12 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/50 text-xl font-bold">+</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                  placeholder="Yeni kategori adı" className="flex-1 h-12 bg-slate-950 border border-blue-500 rounded-lg px-3" />
                <button type="button" onClick={addCategory} className="h-12 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Ekle</button>
                <button type="button" onClick={() => { setShowNewCat(false); setNewCat(""); }} className="h-12 px-3 rounded-lg bg-slate-700">İptal</button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Birim</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Marka</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} data-testid="pf-brand" placeholder="Sandvik, Bosch..."
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kalite</label>
            <input value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} data-testid="pf-quality" placeholder="TiN, HSS, K10..."
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Konum</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="pf-location" placeholder="Raf A-1, Dolap 3..."
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Minimum Stok</label>
            <input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} data-testid="pf-min" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 font-mono-tab" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Mevcut Stok</label>
            <input type="number" step="0.01" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} data-testid="pf-current" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 font-mono-tab" />
          </div>
          <div className="md:col-span-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-950 hover:border-blue-500/50 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.is_special}
                onChange={(e) => setForm({ ...form, is_special: e.target.checked })}
                data-testid="pf-special"
                className="w-5 h-5 accent-blue-600" />
              <span className="text-sm">
                <span className="font-semibold text-blue-300">Özel Takım</span>
                <span className="text-slate-500 ml-2 text-xs">— Bu ürün özel takım olarak işaretlenir. "özel takım" araması yapıldığında tüm işaretli ürünler listelenir.</span>
              </span>
            </label>
          </div>
          <div className="md:col-span-3 flex gap-3">
            <button type="submit" data-testid="pf-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Ad</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Marka / Kalite</th>
                <th className="px-4 py-3">Konum</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Bilemede</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((p) => {
                const crit = p.current_stock <= p.min_stock;
                return (
                  <tr key={p.id} data-testid={`product-row-${p.code}`} className={`h-16 hover:bg-slate-700/40 ${crit ? "bg-red-950/20" : ""}`}>
                    <td className="px-4 font-mono-tab font-semibold text-slate-300">{p.code}</td>
                    <td className="px-4 font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{p.name}</span>
                        {p.is_special && (
                          <span data-testid={`product-special-badge-${p.code}`} className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/10 border border-blue-500/40 rounded px-1.5 py-0.5">
                            Özel Takım
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 text-slate-400 text-sm">{p.category}</td>
                    <td className="px-4 text-slate-400 text-sm">
                      {p.brand && <span className="text-slate-300">{p.brand}</span>}
                      {p.brand && p.quality && <span className="text-slate-600 mx-1">·</span>}
                      {p.quality && <span className="text-slate-400">{p.quality}</span>}
                      {!p.brand && !p.quality && <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 text-slate-400 text-sm">{p.location || <span className="text-slate-600">-</span>}</td>
                    <td className="px-4 text-right font-mono-tab font-bold">
                      <div className="inline-flex items-center gap-2">
                        {crit && <AlertTriangle className="w-4 h-4 text-red-400" />}
                        <span className={crit ? "text-red-400" : ""}>{p.current_stock} {p.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 text-right font-mono-tab font-bold"><span className={Number(p.in_sharpening || 0) > 0 ? "text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1 rounded-md" : "text-slate-400"}>{p.in_sharpening || 0} {p.unit}</span></td>
                    <td className="px-4 text-right font-mono-tab text-slate-400">{p.min_stock}</td>
                    <td className="px-4 min-w-[260px]">
                      {isAdmin && <>
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => setQuickStock({ productId: p.id, direction: "in", quantity: "", note: "" })} data-testid={`product-quick-in-${p.code}`} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs"><Plus className="w-4 h-4" /> Hızlı +</button>
                          <button type="button" onClick={() => setQuickStock({ productId: p.id, direction: "out", quantity: "", note: "" })} data-testid={`product-quick-out-${p.code}`} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs"><Minus className="w-4 h-4" /> Hızlı -</button>
                          <button type="button" onClick={() => edit(p)} data-testid={`product-edit-${p.code}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400" title="Ürünü düzelt"><Pencil className="w-4 h-4" /></button>
                          <button type="button" onClick={() => del(p)} data-testid={`product-delete-${p.code}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400" title="Ürünü sil"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {quickStock.productId === p.id && <form onSubmit={(e) => quickAdjust(e, p.id)} className="mt-2 flex items-center justify-end gap-2 flex-wrap">
                          <input autoFocus required type="number" min="0.01" step="0.01" value={quickStock.quantity} onChange={(e) => setQuickStock({ ...quickStock, quantity: e.target.value })} placeholder="Miktar" className="w-24 h-9 bg-white border border-slate-300 rounded-lg px-2 text-sm text-slate-900" />
                          <input value={quickStock.note} onChange={(e) => setQuickStock({ ...quickStock, note: e.target.value })} placeholder="Kısa not (ops.)" className="w-36 h-9 bg-white border border-slate-300 rounded-lg px-2 text-sm text-slate-900" />
                          <button type="submit" className={`h-9 px-3 rounded-lg text-white font-bold text-xs ${quickStock.direction === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>{quickStock.direction === "in" ? "Artır" : "Eksilt"}</button>
                          <button type="button" onClick={() => setQuickStock({ productId: "", direction: "in", quantity: "", note: "" })} className="h-9 px-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs">İptal</button>
                        </form>}
                      </>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">Ürün bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showImport && <ProductImport onClose={() => setShowImport(false)} onCommitted={load} />}
    </div>
  );
}
