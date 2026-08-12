import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const empty = { first_name: "", last_name: "", reg_no: "", department: "", email: "" };

export default function Personnel() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/personnel").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) => {
    const s = q.toLowerCase();
    return !s || `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) || p.reg_no.toLowerCase().includes(s) || (p.department || "").toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/personnel/${editId}`, form);
      else await api.post("/personnel", form);
      toast.success(editId ? "Güncellendi" : "Eklendi");
      setShowForm(false); setEditId(null); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const edit = (p) => { setForm(p); setEditId(p.id); setShowForm(true); };
  const del = async (p) => {
    if (!window.confirm(`${p.first_name} ${p.last_name} silinsin mi?`)) return;
    try { await api.delete(`/personnel/${p.id}`); toast.success("Silindi"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Ekip</div>
          <h1 className="font-display text-4xl font-black">Personel</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} personel</p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }} data-testid="personnel-add-btn"
          className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30">
          <Plus className="w-5 h-5" /> Yeni Personel
        </button>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, sicil, departman ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ad</label>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="perf-first" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Soyad</label>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="perf-last" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Sicil No</label>
            <input required value={form.reg_no} onChange={(e) => setForm({ ...form, reg_no: e.target.value })} data-testid="perf-reg" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Departman</label>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">E-posta</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" /></div>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" data-testid="perf-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
              <th className="px-4 py-3">Sicil</th><th className="px-4 py-3">Ad Soyad</th><th className="px-4 py-3">Departman</th><th className="px-4 py-3">E-posta</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filtered.map((p) => (
              <tr key={p.id} className="h-16 hover:bg-slate-700/40">
                <td className="px-4 font-mono-tab font-semibold">{p.reg_no}</td>
                <td className="px-4 font-medium">{p.first_name} {p.last_name}</td>
                <td className="px-4 text-slate-400">{p.department}</td>
                <td className="px-4 text-slate-400 text-sm">{p.email}</td>
                <td className="px-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => edit(p)} data-testid={`personnel-edit-${p.reg_no}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(p)} data-testid={`personnel-delete-${p.reg_no}`} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Personel bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
