import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";
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

      {filtered.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-500">Henüz tedarikçi yok. Yukarıdan yeni tedarikçi ekleyin.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const t = totalMap[s.name];
            return (
              <div key={s.id} data-testid={`supplier-${s.name}`} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 flex flex-col gap-3 hover:border-blue-500/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-lg font-bold truncate">{s.name}</div>
                    {s.contact_person && <div className="text-slate-400 text-sm truncate">{s.contact_person}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isAdmin && (
                      <>
                        <button onClick={() => edit(s)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(s)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  {s.phone && <div>Tel: <span className="text-slate-300">{s.phone}</span></div>}
                  {s.email && <div>E-posta: <span className="text-slate-300 truncate">{s.email}</span></div>}
                  {s.address && <div className="truncate">Adres: <span className="text-slate-300">{s.address}</span></div>}
                </div>
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
      )}
    </div>
  );
}
