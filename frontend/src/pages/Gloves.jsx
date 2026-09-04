import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PackagePlus, PackageMinus, FileSpreadsheet, Search, X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const emptyGlove = { name: "", size: "", brand: "", unit: "çift", min_stock: 0, current_stock: 0, location: "", note: "" };
const today = () => new Date().toISOString().slice(0, 10);

export default function Gloves() {
  const { isAdmin } = useAuth();
  const [gloves, setGloves] = useState([]);
  const [people, setPeople] = useState([]);
  const [movements, setMovements] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyGlove);
  const [editId, setEditId] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: "", personnel_id: "", transaction_date: today(), supplier: "", note: "" });
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState({ personnel_id: "", date_from: "", date_to: "" });

  const load = async () => {
    try {
      const [g, p, m] = await Promise.all([api.get("/gloves"), api.get("/personnel"), api.get("/glove-movements")]);
      setGloves(g.data || []); setPeople(p.data || []); setMovements(m.data || []);
    } catch (e) { toast.error(e.response?.data?.detail || "Eldiven verileri yüklenemedi"); }
  };
  useEffect(() => { load(); }, []);

  const filteredGloves = useMemo(() => gloves.filter((g) => `${g.name} ${g.size || ""} ${g.brand || ""} ${g.location || ""}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))), [gloves, query]);
  const filteredMovements = useMemo(() => movements.filter((m) => {
    if (historyFilter.personnel_id && m.personnel_id !== historyFilter.personnel_id) return false;
    if (historyFilter.date_from && m.transaction_date < historyFilter.date_from) return false;
    if (historyFilter.date_to && m.transaction_date > historyFilter.date_to) return false;
    return true;
  }), [movements, historyFilter]);
  const outOfStockGloves = useMemo(() => filteredGloves.filter((g) => Number(g.current_stock || 0) === 0), [filteredGloves]);
  const personNameById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()])), [people]);
  const resolvePersonName = (movement) => movement.personnel_name || personNameById[movement.personnel_id] || "Personel belirtilmemiş";
  const makePersonSummary = (list) => {
    const byPerson = {};
    list.filter((m) => m.type === "out").forEach((m) => {
      const key = m.personnel_id || m.personnel_name || "bilinmeyen";
      if (!byPerson[key]) byPerson[key] = { name: resolvePersonName(m), total: 0, gloves: {} };
      byPerson[key].total += Number(m.quantity || 0);
      const gloveKey = m.glove_id || m.glove_name;
      if (!byPerson[key].gloves[gloveKey]) byPerson[key].gloves[gloveKey] = { name: m.glove_name || "Eldiven", size: m.size || "", brand: m.brand || "", quantity: 0 };
      byPerson[key].gloves[gloveKey].quantity += Number(m.quantity || 0);
    });
    return Object.values(byPerson).sort((a, b) => b.total - a.total);
  };
  const personSummary = useMemo(() => makePersonSummary(filteredMovements), [filteredMovements]);
  const allPersonSummary = useMemo(() => makePersonSummary(movements), [movements]);

  const saveGlove = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Eldiven adı zorunludur");
    try {
      const payload = { ...form, min_stock: Number(form.min_stock) || 0, current_stock: Number(form.current_stock) || 0 };
      if (editId) await api.put(`/gloves/${editId}`, payload); else await api.post("/gloves", payload);
      toast.success(editId ? "Eldiven güncellendi" : "Eldiven stok kartı oluşturuldu");
      setForm(emptyGlove); setEditId(null); setShowForm(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt yapılamadı"); }
  };
  const removeGlove = async (g) => {
    if (!window.confirm(`${g.name} silinsin mi?`)) return;
    try { await api.delete(`/gloves/${g.id}`); toast.success("Eldiven silindi"); load(); } catch (e) { toast.error(e.response?.data?.detail || "Silinemedi"); }
  };
  const openStock = (g, mode) => { setStockModal({ glove: g, mode }); setStockForm({ quantity: "", personnel_id: "", transaction_date: today(), supplier: "", note: "" }); };
  const submitStock = async (e) => {
    e.preventDefault();
    const qty = Number(stockForm.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Miktar 0'dan büyük olmalıdır");
    if (stockModal.mode === "out" && !stockForm.personnel_id) return toast.error("Personel seçin");
    try {
      const url = stockModal.mode === "in" ? `/gloves/${stockModal.glove.id}/in` : `/gloves/${stockModal.glove.id}/out`;
      const payload = stockModal.mode === "in" ? { quantity: qty, supplier: stockForm.supplier, note: stockForm.note, transaction_date: stockForm.transaction_date } : { quantity: qty, personnel_id: stockForm.personnel_id, transaction_date: stockForm.transaction_date, note: stockForm.note };
      await api.post(url, payload);
      toast.success(stockModal.mode === "in" ? "Eldiven stoğu artırıldı" : "Eldiven çıkışı kaydedildi");
      setStockModal(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "İşlem yapılamadı"); }
  };
  const exportExcel = () => {
    const rows = filteredMovements.filter((m) => m.type === "out").map((m) => ({
      "Tarih": m.transaction_date || "", "İşlem": m.type === "out" ? "Çıkış" : "Stok Girişi", "Eldiven": m.glove_name || "", "Beden": m.size || "", "Marka": m.brand || "", "Miktar": m.quantity || 0, "Personel": m.personnel_name || "", "Tedarikçi": m.supplier || "", "Not": m.note || "",
    }));
    if (!rows.length) return toast.info("Dışa aktarılacak eldiven hareketi bulunamadı");
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!autofilter"] = { ref: `A1:${String.fromCharCode(64 + Object.keys(rows[0]).length)}${rows.length + 1}` };
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Eldiven Kullanımı");
    XLSX.writeFile(wb, `eldiven-kullanimi-${today()}.xlsx`);
    toast.success("Eldiven Excel raporu indirildi");
  };

  return <div className="space-y-6 gloves-page">
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div><div className="text-xs text-cyan-400 uppercase tracking-[0.2em] font-semibold mb-2">Bağımsız Sarfiyat</div><h1 className="font-display text-4xl font-black">Eldiven Takip</h1><p className="text-slate-700 text-sm mt-1">Ürünler stokundan bağımsız eldiven stok ve kullanım yönetimi</p></div>
      <div className="flex gap-2 flex-wrap">{isAdmin && <button onClick={() => { setForm(emptyGlove); setEditId(null); setShowForm(true); }} className="h-12 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Yeni Eldiven</button>}<button type="button" aria-label={showHistory ? "Stok kartlarına dön" : "Kullanım geçmişini aç"} onClick={() => { setShowHistory((v) => !v); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-12 px-4 rounded-lg bg-slate-800 border border-slate-600 text-white font-bold">{showHistory ? "Stok Kartlarına Dön" : "Kullanım Geçmişi"}</button><button onClick={exportExcel} className="h-12 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel’e Aktar</button></div>
    </div>

    {!showHistory ? <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="rounded-2xl border border-cyan-700/60 bg-white p-5"><div className="text-sm font-bold text-cyan-900">Eldiven Çeşidi</div><div className="mt-1 text-3xl font-black text-slate-950">{filteredGloves.length}</div><div className="text-xs text-slate-700">listelenen stok kartı</div></div><div className="rounded-2xl border border-emerald-700/60 bg-white p-5"><div className="text-sm font-bold text-emerald-900">Toplam Eldiven Stoku</div><div className="mt-1 text-3xl font-black text-emerald-300">{filteredGloves.reduce((sum, g) => sum + Number(g.current_stock || 0), 0)}</div><div className="text-xs text-slate-700">stok kartlarının toplamı</div></div><div className="rounded-2xl border border-rose-700/60 bg-white p-5"><div className="text-sm font-bold text-rose-900">Kritik Stok</div><div className="mt-1 text-3xl font-black text-rose-300">{filteredGloves.filter((g) => Number(g.current_stock || 0) <= Number(g.min_stock || 0)).length}</div><div className="text-xs text-slate-700">minimum seviyede veya altında</div></div></div>
      <div className="rounded-2xl border border-rose-600/70 bg-rose-50 overflow-hidden"><div className="px-5 py-4 border-b border-rose-800/60 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-rose-900">Stoğu Biten Eldivenler</h2><p className="text-sm text-rose-900">Mevcut stok miktarı sıfır olan eldivenler</p></div><span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-black text-white">{outOfStockGloves.length} kayıt</span></div>{outOfStockGloves.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-rose-900/40 text-rose-100"><tr><th className="p-3 text-left">Eldiven</th><th className="p-3 text-left">Marka</th><th className="p-3 text-left">Beden</th><th className="p-3 text-left">Mevcut Stok</th><th className="p-3 text-left">Minimum Stok</th><th className="p-3 text-left">Konum</th></tr></thead><tbody>{outOfStockGloves.map((g) => <tr key={g.id} className="border-t border-rose-900/50"><td className="p-3 font-black text-slate-950">{g.name}</td><td className="p-3 text-slate-200">{g.brand || "-"}</td><td className="p-3 text-slate-200">{g.size || "-"}</td><td className="p-3 font-black text-rose-300">0 {g.unit || "çift"}</td><td className="p-3 text-slate-200">{g.min_stock || 0} {g.unit || "çift"}</td><td className="p-3 text-slate-200">{g.location || "-"}</td></tr>)}</tbody></table></div> : <div className="p-5 text-sm font-bold text-emerald-300">Stoğu tamamen biten eldiven bulunmuyor.</div>}</div>
      <div className="rounded-2xl border border-cyan-700/70 bg-white overflow-hidden"><div className="px-5 py-4 border-b border-cyan-700/60 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-cyan-900">Personel Eldiven Kullanımı</h2><p className="text-sm text-cyan-900">Kime kaç adet verildiği ve hangi eldiveni kullandığı</p></div><span className="rounded-full bg-cyan-600 px-3 py-1 text-sm font-black text-white">{allPersonSummary.length} personel</span></div>{allPersonSummary.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-cyan-900/50 text-cyan-50"><tr><th className="p-3 text-left">Personel</th><th className="p-3 text-left">Aldığı eldivenler</th><th className="p-3 text-right">Toplam adet</th></tr></thead><tbody>{allPersonSummary.map((person) => <tr key={person.name} className="border-t border-cyan-800/60 hover:bg-cyan-500/10"><td className="p-3 font-black text-slate-950">{person.name}</td><td className="p-3 text-slate-200">{Object.values(person.gloves).map((g) => `${g.name}${g.size ? ` • ${g.size}` : ""}${g.brand ? ` • ${g.brand}` : ""}: ${g.quantity}`).join("  |  ")}</td><td className="p-3 text-right font-black text-cyan-900">{person.total}</td></tr>)}</tbody></table></div> : <div className="p-5 text-sm font-bold text-slate-300">Henüz personele verilmiş eldiven kaydı bulunmuyor.</div>}</div>
      <div className="relative"><Search className="w-5 h-5 text-slate-700 absolute left-4 top-1/2 -translate-y-1/2" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Eldiven adı, beden, marka veya konum ara..." className="w-full h-13 bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 outline-none focus:ring-2 focus:ring-cyan-500" /></div>
      {showForm && <form onSubmit={saveGlove} className="bg-cyan-50 border border-cyan-700/50 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3"><input required placeholder="Eldiven adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input placeholder="Beden" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input placeholder="Marka" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input placeholder="Birim (çift/adet)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input type="number" min="0" placeholder="Minimum stok" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input type="number" min="0" placeholder="İlk mevcut stok" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input placeholder="Konum" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input placeholder="Not" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><div className="md:col-span-4 flex gap-2"><button className="h-11 px-5 rounded-lg bg-cyan-600 text-white font-bold">{editId ? "Güncelle" : "Kaydet"}</button><button type="button" onClick={() => setShowForm(false)} className="h-11 px-5 rounded-lg bg-slate-700 text-white font-bold">İptal</button></div></form>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{filteredGloves.map((g) => <div key={g.id} className={`rounded-2xl border p-5 bg-slate-900/80 ${Number(g.current_stock) <= Number(g.min_stock) ? "border-rose-500/70" : "border-slate-700"}`}><div className="flex justify-between gap-3"><div><h2 className="font-bold text-lg text-slate-950">{g.name}</h2><p className="text-slate-300 text-sm">{g.brand || "Marka yok"} {g.size ? `• Beden ${g.size}` : ""}</p><p className="text-slate-700 text-xs mt-1">{g.location || "Konum belirtilmedi"}</p></div><div className="text-right"><div className="text-4xl font-black text-cyan-300">{Number(g.current_stock || 0)}</div><div className="text-sm font-bold text-white">{g.unit || "çift"} mevcut stok</div>{Number(g.current_stock || 0) <= Number(g.min_stock || 0) && <div className="mt-1 text-xs font-black text-rose-300">KRİTİK STOK</div>}</div></div><div className="flex gap-2 mt-5 flex-wrap">{isAdmin && <><button onClick={() => openStock(g, "in")} className="h-10 px-3 rounded-lg bg-emerald-700 text-white font-bold flex items-center gap-1"><PackagePlus className="w-4 h-4" /> Stok Girişi</button><button onClick={() => openStock(g, "out")} className="h-10 px-3 rounded-lg bg-amber-600 text-white font-bold flex items-center gap-1"><PackageMinus className="w-4 h-4" /> Personel Çıkışı</button><button onClick={() => { setForm({ ...emptyGlove, ...g }); setEditId(g.id); setShowForm(true); }} className="h-10 px-3 rounded-lg bg-slate-700 text-white font-bold"><Pencil className="w-4 h-4 inline mr-1" />Düzelt</button><button onClick={() => removeGlove(g)} className="h-10 px-3 rounded-lg bg-rose-700 text-white font-bold"><Trash2 className="w-4 h-4 inline mr-1" />Sil</button></>}</div></div>)}</div>
    </> : <div className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-slate-950">Eldiven Kullanım Geçmişi</h2><p className="text-sm text-slate-700">Personel bazında tarihli eldiven tüketimlerini inceleyin.</p></div><button type="button" aria-label="Stok kartlarına geri dön" onClick={() => { setShowHistory(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="h-11 px-5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Geri Dön</button></div><div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3"><select value={historyFilter.personnel_id} onChange={(e) => setHistoryFilter({ ...historyFilter, personnel_id: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3"><option value="">Tüm personel</option>{people.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select><input type="date" value={historyFilter.date_from} onChange={(e) => setHistoryFilter({ ...historyFilter, date_from: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><input type="date" value={historyFilter.date_to} onChange={(e) => setHistoryFilter({ ...historyFilter, date_to: e.target.value })} className="h-11 bg-slate-950 border border-slate-700 rounded-lg px-3" /><button onClick={() => setHistoryFilter({ personnel_id: "", date_from: "", date_to: "" })} className="h-11 rounded-lg bg-slate-700 text-white font-bold">Filtreyi Temizle</button></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{personSummary.map((person) => <div key={person.name} className="bg-slate-900/80 border border-cyan-800/60 rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-950">{person.name}</h2><span className="text-cyan-300 font-black text-xl">{person.total} çift</span></div><div className="mt-3 space-y-2">{Object.values(person.gloves).map((g) => <div key={`${g.name}-${g.size}-${g.brand}`} className="flex justify-between gap-3 text-sm border-t border-slate-800 pt-2"><span className="text-slate-200">{g.name}{g.size ? ` • Beden ${g.size}` : ""}{g.brand ? ` • ${g.brand}` : ""}</span><strong className="text-emerald-300">{g.quantity}</strong></div>)}</div></div>)}</div>{!personSummary.length && <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-6 text-slate-700">Seçilen tarih aralığında personel çıkışı bulunamadı.</div>}<div className="bg-slate-900/70 border border-slate-700 rounded-2xl overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-800 text-slate-100"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">İşlem</th><th className="p-3 text-left">Eldiven</th><th className="p-3 text-left">Beden/Marka</th><th className="p-3 text-left">Miktar</th><th className="p-3 text-left">Personel</th><th className="p-3 text-left">Tedarikçi</th></tr></thead><tbody>{filteredMovements.map((m) => <tr key={m.id} className="border-t border-slate-800"><td className="p-3">{m.transaction_date}</td><td className="p-3 font-bold">{m.type === "out" ? "Personel Çıkışı" : "Stok Girişi"}</td><td className="p-3">{m.glove_name}</td><td className="p-3">{m.size || "-"} / {m.brand || "-"}</td><td className="p-3">{m.quantity}</td><td className="p-3">{resolvePersonName(m)}</td><td className="p-3">{m.supplier || "-"}</td></tr>)}</tbody></table></div></div>}
    {stockModal && <div className="fixed inset-0 z-[10000] bg-slate-950/80 flex items-start justify-center p-4 pt-6 md:pt-10 overflow-y-auto"><form onSubmit={submitStock} className="w-full max-w-lg bg-slate-900 border border-cyan-700 rounded-2xl p-6 space-y-4"><div className="flex justify-between"><div><h2 className="text-xl font-black">{stockModal.mode === "in" ? "Eldiven Stok Girişi" : "Personel Eldiven Çıkışı"}</h2><p className="text-slate-700 text-sm">{stockModal.glove.name} • {stockModal.glove.brand || "Marka yok"}</p></div><button type="button" onClick={() => setStockModal(null)}><X /></button></div><input required type="number" min="0.01" step="0.01" placeholder="Miktar" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />{stockModal.mode === "out" ? <select required value={stockForm.personnel_id} onChange={(e) => setStockForm({ ...stockForm, personnel_id: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3"><option value="">Personel seçin</option>{people.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select> : <input placeholder="Tedarikçi" value={stockForm.supplier} onChange={(e) => setStockForm({ ...stockForm, supplier: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />}<input required type="date" value={stockForm.transaction_date} onChange={(e) => setStockForm({ ...stockForm, transaction_date: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /><textarea placeholder="Not" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} className="w-full min-h-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" /><button className="w-full h-12 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black">Kaydet</button></form></div>}
  </div>;
}
