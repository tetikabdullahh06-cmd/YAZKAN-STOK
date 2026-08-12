import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const emptyForm = { code: "", name: "", brand: "", model: "", type: "", description: "" };
const DEFAULT_TYPES = ["CNC Torna", "CNC Freze / Dik İşleme", "Üniversal Torna", "Taşlama", "Delme", "Diğer"];
const TYPE_STORAGE_KEY = "cnc_extra_machine_types";

export default function Machines() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [extraTypes, setExtraTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TYPE_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [newType, setNewType] = useState("");
  const [showNewType, setShowNewType] = useState(false);

  const load = () => api.get("/machines").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const allTypes = Array.from(new Set([...DEFAULT_TYPES, ...extraTypes, ...items.map((m) => m.type).filter(Boolean)]));
  const addType = () => {
    const t = newType.trim();
    if (!t) return;
    if (!allTypes.includes(t)) {
      const next = [...extraTypes, t];
      setExtraTypes(next);
      localStorage.setItem(TYPE_STORAGE_KEY, JSON.stringify(next));
    }
    setForm({ ...form, type: t });
    setNewType(""); setShowNewType(false);
    toast.success(`"${t}" türü eklendi`);
  };

  const filtered = items.filter((m) => {
    const s = q.toLowerCase();
    return !s || m.code.toLowerCase().includes(s) || m.name.toLowerCase().includes(s) || (m.brand || "").toLowerCase().includes(s) || (m.type || "").toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/machines/${editId}`, form);
      else await api.post("/machines", form);
      toast.success(editId ? "Güncellendi" : "Eklendi");
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const edit = (m) => { setForm({ ...emptyForm, ...m }); setEditId(m.id); setShowForm(true); };
  const del = async (m) => {
    if (!window.confirm(`${m.name} silinsin mi?`)) return;
    try { await api.delete(`/machines/${m.id}`); toast.success("Silindi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Ekipman</div>
          <h1 className="font-display text-4xl font-black">Tezgahlar</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} tezgah</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }} data-testid="machine-add-btn"
            className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-900/30">
            <Plus className="w-5 h-5" /> Yeni Tezgah
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, isim, marka, tür ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Kod</label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} data-testid="mf-code" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ad</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="mf-name" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tür</label>
            {!showNewType ? (
              <div className="flex gap-2">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="mf-type" className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                  <option value="">-- Tür seçin --</option>
                  {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewType(true)} data-testid="mf-add-type" title="Yeni tür"
                  className="h-12 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/50 text-xl font-bold">+</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newType} onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addType(); } }}
                  placeholder="Yeni tür" className="flex-1 h-12 bg-slate-950 border border-blue-500 rounded-lg px-3" />
                <button type="button" onClick={addType} className="h-12 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Ekle</button>
                <button type="button" onClick={() => { setShowNewType(false); setNewType(""); }} className="h-12 px-3 rounded-lg bg-slate-700">İptal</button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Marka</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Model</label>
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Açıklama</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" data-testid="mf-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
              <th className="px-4 py-3">Kod</th>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3">Marka / Model</th>
              <th className="px-4 py-3">Açıklama</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filtered.map((m) => (
              <tr key={m.id} className="h-16 hover:bg-slate-700/40">
                <td className="px-4 font-mono-tab font-semibold">{m.code}</td>
                <td className="px-4 font-medium">{m.name}</td>
                <td className="px-4 text-slate-300 text-sm">{m.type || <span className="text-slate-600">-</span>}</td>
                <td className="px-4 text-slate-400 text-sm">{m.brand} {m.model && `· ${m.model}`}</td>
                <td className="px-4 text-slate-500 text-sm">{m.description}</td>
                <td className="px-4">
                  <div className="flex justify-end gap-2">
                    {isAdmin && (
                      <>
                        <button onClick={() => edit(m)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(m)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Tezgah bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
