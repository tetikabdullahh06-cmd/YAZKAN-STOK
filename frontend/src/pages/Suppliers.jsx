import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Plus, Pencil, Trash2, Search, Building2, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { name: "", contact_person: "", phone: "", email: "", address: "", note: "" };

export default function Suppliers() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState([]); // by-supplier totals
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [materialRows, setMaterialRows] = useState([]);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialFilters, setMaterialFilters] = useState(() => { const to = new Date(); const from = new Date(); from.setFullYear(from.getFullYear() - 1); return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) }; });

  const load = () => Promise.all([
    api.get("/suppliers").then((r) => setItems(r.data)),
    api.get("/reports/by-supplier").then((r) => setTotals(r.data)).catch(() => setTotals([])),
  ]);
  useEffect(() => { load(); }, []);

  const totalMap = Object.fromEntries(totals.map((t) => [t.name, t]));
  const filtered = items.filter((s) => {
    const q2 = q.toLowerCase();
    return !q2 || s.name.toLowerCase().includes(q2) || (s.contact_person || "").toLowerCase().includes(q2);
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post("/suppliers", form);
      toast.success(editId ? "Güncellendi" : "Eklendi");
      setShowForm(false); setEditId(null); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const edit = (s) => { setForm(s); setEditId(s.id); setShowForm(true); };
  const del = async (s) => {
    if (!window.confirm(`${s.name} silinsin mi?`)) return;
    try { await api.delete(`/suppliers/${s.id}`); toast.success("Silindi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const currency = (v) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v || 0);
  const loadSupplierMaterials = async (supplier, filters = materialFilters) => {
    const from = new Date(`${filters.date_from}T00:00:00`); const to = new Date(`${filters.date_to}T23:59:59`);
    if (from > to) return toast.error("Başlangıç tarihi bitiş tarihinden sonra olamaz");
    if ((to - from) / 86400000 > 366) return toast.error("Tarih aralığı en fazla 1 yıl olabilir");
    setMaterialLoading(true);
    try { const r = await api.get(`/suppliers/${supplier.id}/materials`, { params: filters }); setMaterialRows(r.data.materials || []); setSelectedSupplier(r.data.supplier || supplier); }
    catch (e) { toast.error(e.response?.data?.detail || "Tedarikçi malzemeleri yüklenemedi"); }
    finally { setMaterialLoading(false); }
  };
  const openSupplierMaterials = (supplier) => { setSelectedSupplier(supplier); loadSupplierMaterials(supplier); };
  const exportSupplierMaterials = () => {
    if (!selectedSupplier || !materialRows.length) return toast.info("Dışa aktarılacak malzeme bulunamadı");
    const rows = materialRows.map((m) => ({ "Tarih": m.transaction_date || (m.created_at || "").slice(0, 10), "Stok Türü": m.stock_kind === "toolholder" ? "Takım Tutucu" : "Ürün", "Malzeme": m.material_name || "-", "Kod": m.product_code || m.code || "-", "Miktar": m.quantity ?? 0, "Birim": m.unit || "adet", "Not": m.note || "" }));
    const ws = XLSX.utils.json_to_sheet(rows);
    if (rows.length) ws["!autofilter"] = { ref: `A1:H${rows.length + 1}` };
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 42 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Tedarikçi Malzemeleri"); XLSX.writeFile(wb, `${selectedSupplier.name}-malzemeler.xlsx`); toast.success("Tedarikçi malzemeleri, filtreli Excel olarak aktarıldı");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Tedarik Zinciri</div>
          <h1 className="font-display text-4xl font-black">Tedarikçiler</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} tedarikçi</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }} data-testid="supplier-add-btn"
            className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30">
            <Plus className="w-5 h-5" /> Yeni Tedarikçi
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya kişi ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">İsim</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="sup-name" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Yetkili Kişi</label>
            <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Telefon</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">E-posta</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Adres</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Not</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" data-testid="sup-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600">İptal</button>
          </div>
        </form>
      )}

      {selectedSupplier && (
        <section className="bg-slate-800/70 border-2 border-blue-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3"><button onClick={() => setSelectedSupplier(null)} className="h-10 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Listeye Dön</button><div><h2 className="font-display text-2xl font-black">{selectedSupplier.name} — Alınan Malzemeler</h2><p className="text-slate-300 text-sm font-bold">Filtrelenen kayıt: {materialRows.length}</p></div></div>
            <button onClick={exportSupplierMaterials} disabled={!materialRows.length} className="h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Excel'e Aktar</button>
          </div>
          <div className="flex gap-3 flex-wrap items-end">
            <label className="text-sm font-bold text-slate-200">Başlangıç<input type="date" value={materialFilters.date_from} onChange={(e) => setMaterialFilters({ ...materialFilters, date_from: e.target.value })} className="block mt-1 h-10 bg-slate-950 border border-slate-600 rounded-lg px-3 text-white font-bold" /></label>
            <label className="text-sm font-bold text-slate-200">Bitiş<input type="date" value={materialFilters.date_to} onChange={(e) => setMaterialFilters({ ...materialFilters, date_to: e.target.value })} className="block mt-1 h-10 bg-slate-950 border border-slate-600 rounded-lg px-3 text-white font-bold" /></label>
            <button onClick={() => loadSupplierMaterials(selectedSupplier)} className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Filtrele</button>
            <span className="text-xs text-slate-300 font-bold">En fazla 1 yıl</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700"><table className="w-full text-sm"><thead><tr className="bg-slate-950 text-slate-100"><th className="text-left p-3 font-black">Tarih</th><th className="text-left p-3 font-black">Tür</th><th className="text-left p-3 font-black">Malzeme</th><th className="text-left p-3 font-black">Kod</th><th className="text-right p-3 font-black">Miktar</th><th className="text-left p-3 font-black">Birim</th><th className="text-left p-3 font-black">Açıklama</th></tr></thead><tbody>{materialLoading ? <tr><td colSpan="7" className="p-8 text-center font-bold text-slate-300">Yükleniyor...</td></tr> : materialRows.length === 0 ? <tr><td colSpan="7" className="p-8 text-center font-bold text-slate-300">Bu tarih aralığında alınan malzeme yok.</td></tr> : materialRows.map((m, i) => <tr key={`${m.id || m.created_at}-${i}`} className="border-t border-slate-700"><td className="p-3 font-bold">{m.transaction_date || (m.created_at || "").slice(0, 10) || "-"}</td><td className="p-3 font-bold">{m.stock_kind === "toolholder" ? "Takım Tutucu" : "Ürün"}</td><td className="p-3 font-bold">{m.material_name || "-"}</td><td className="p-3 font-mono font-bold">{m.product_code || m.code || "-"}</td><td className="p-3 text-right font-mono font-black">{m.quantity ?? 0}</td><td className="p-3 font-bold">{m.unit || "adet"}</td><td className="p-3 font-bold text-slate-300">{m.note || m.description || "-"}</td></tr>)}</tbody></table></div>
        </section>
      )}

      {!selectedSupplier && (filtered.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-500">Henüz tedarikçi yok. Yukarıdan yeni tedarikçi ekleyin.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const t = totalMap[s.name];
            return (
              <div key={s.id} data-testid={`supplier-${s.name}`} onClick={() => openSupplierMaterials(s)} role="button" tabIndex={0} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3 hover:border-blue-500/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold truncate">{s.name}</div>
                    {s.contact_person && <div className="text-slate-400 text-sm truncate">{s.contact_person}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isAdmin && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); edit(s); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); del(s); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {s.phone && <div>Tel: <span className="text-slate-300">{s.phone}</span></div>}
                  {s.email && <div>E-posta: <span className="text-slate-300 truncate">{s.email}</span></div>}
                  {s.address && <div className="truncate">Adres: <span className="text-slate-300">{s.address}</span></div>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); openSupplierMaterials(s); }} className="mt-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-sm">Malzeme Geçmişini Aç</button>
                {t && (
                  <div className="mt-2 pt-3 border-t border-slate-700 flex justify-between text-sm">
                    <div><div className="text-slate-500 text-xs uppercase tracking-widest">Toplam Alım</div><div className="font-bold font-mono-tab text-emerald-400">{currency(t.total)}</div></div>
                    <div className="text-right"><div className="text-slate-500 text-xs uppercase tracking-widest">Sipariş</div><div className="font-bold font-mono-tab">{t.count}</div></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
