import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, FileSpreadsheet, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadImageWorkbook, imageExportNotice } from "@/lib/excelExport";
import { useAuth } from "@/context/AuthContext";
import ImageUpload, { ImageHover } from "@/components/ImageUpload";

const emptyForm = { first_name: "", last_name: "", department: "", image_url: "" };
const DEFAULT_DEPTS = ["CNC Dik İşlemeci", "CNC Tornacı", "Üniversal Tornacı", "Taşlamacı", "Üretim Mühendisi"];
const DEPT_STORAGE_KEY = "cnc_extra_departments";

export default function Personnel() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [extraDepts, setExtraDepts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DEPT_STORAGE_KEY)) || []; } catch { return []; }
  });
  const [newDept, setNewDept] = useState("");
  const [showNewDept, setShowNewDept] = useState(false);

  const load = () => api.get("/personnel").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const allDepts = Array.from(new Set([...DEFAULT_DEPTS, ...extraDepts, ...items.map((p) => p.department).filter(Boolean)]));

  const addDept = () => {
    const d = newDept.trim();
    if (!d) return;
    if (!allDepts.includes(d)) {
      const next = [...extraDepts, d];
      setExtraDepts(next);
      localStorage.setItem(DEPT_STORAGE_KEY, JSON.stringify(next));
    }
    setForm({ ...form, department: d });
    setNewDept(""); setShowNewDept(false);
    toast.success(`"${d}" görevi eklendi`);
  };

  const filtered = items.filter((p) => {
    const s = q.toLowerCase();
    return !s || `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) || (p.department || "").toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/personnel/${editId}`, form);
      else await api.post("/personnel", form);
      toast.success(editId ? "Güncellendi" : "Eklendi");
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };
  const edit = (p) => { setForm({ first_name: p.first_name, last_name: p.last_name, department: p.department || "", image_url: p.image_url || "" }); setEditId(p.id); setShowForm(true); };
  const exportExcel = async (includeImages = true) => { const rows = filtered.map((p) => ({ "Ad": p.first_name, "Soyad": p.last_name, "Görev": p.department || "", "Görsel": "", __imageUrl: p.image_url || "" })); await downloadImageWorkbook({ sheetName: "Personel", rows, imageKey: "Görsel", imageSourceKey: "__imageUrl", includeImages, filename: `YAZKAN-personel-${includeImages ? "resimli" : "resimsiz"}-${new Date().toISOString().slice(0, 10)}.xlsx` }); toast.success(`${rows.length} personel ${includeImages ? "resimli" : "resimsiz"} Excel'e aktarıldı`); };
  const downloadTemplate = () => { const ws = XLSX.utils.json_to_sheet([{ first_name: "Örnek", last_name: "Personel", department: "CNC Tornacı", image_url: "" }]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Personel Şablonu"); XLSX.writeFile(wb, "personel-ice-aktarma-sablonu.xlsx"); };
  const importExcel = async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { const data = await file.arrayBuffer(); const wb = XLSX.read(data, { type: "array" }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }); const blob = new Blob([await file.arrayBuffer()], { type: file.type }); const fd = new FormData(); fd.append("file", blob, file.name); const preview = await api.post("/personnel/import?commit=false", fd, { headers: { "Content-Type": "multipart/form-data" } }); if (!window.confirm(`${preview.data.preview?.length || rows.length} satır içe aktarılacak. Devam edilsin mi?`)) return; const commitFd = new FormData(); commitFd.append("file", blob, file.name); await api.post("/personnel/import?commit=true", commitFd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Personel Excel içe aktarma tamamlandı"); load(); } catch (e) { toast.error(e.response?.data?.detail || "Excel içe aktarılamadı"); } };

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
        <div className="flex gap-2 flex-wrap">{isAdmin && (<>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }} data-testid="personnel-add-btn"
            className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-900/30">
            <Plus className="w-5 h-5" /> Yeni Personel
          </button>
          <label className="h-14 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-2 cursor-pointer"><FileSpreadsheet className="w-5 h-5" /> Excel İçe Aktar<input type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" /></label>
          <button onClick={downloadTemplate} className="h-14 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"><FileSpreadsheet className="w-5 h-5 inline mr-2" />Şablon</button>
        </>)}<button onClick={() => exportExcel(true)} className="h-14 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold"><Download className="w-5 h-5 inline mr-2" />Resimli Excel</button><button onClick={() => exportExcel(false)} className="h-14 px-5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold"><Download className="w-5 h-5 inline mr-2" />Resimsiz Excel</button></div>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad veya görev ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ad</label>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="perf-first" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Soyad</label>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="perf-last" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Görev</label>
            {!showNewDept ? (
              <div className="flex gap-2">
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} data-testid="perf-dept" className="flex-1 h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                  <option value="">-- Görev seçin --</option>
                  {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewDept(true)} data-testid="perf-add-dept" title="Yeni görev ekle"
                  className="h-12 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-600/50 text-xl font-bold">+</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newDept} onChange={(e) => setNewDept(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDept(); } }}
                  placeholder="Yeni görev adı" className="flex-1 h-12 bg-slate-950 border border-blue-500 rounded-lg px-3" />
                <button type="button" onClick={addDept} className="h-12 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold">Ekle</button>
                <button type="button" onClick={() => { setShowNewDept(false); setNewDept(""); }} className="h-12 px-3 rounded-lg bg-slate-700">İptal</button>
              </div>
            )}
          </div>
          <div className="md:col-span-2"><ImageUpload value={form.image_url} onChange={(image_url) => setForm({ ...form, image_url })} label="Personel görseli" /></div>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" data-testid="perf-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">Görev</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filtered.map((p) => (
              <tr key={p.id} className="h-16 hover:bg-slate-700/40">
                <td className="px-4 font-medium">{p.first_name} {p.last_name}<ImageHover src={p.image_url} alt={`${p.first_name} ${p.last_name}`} /></td>
                <td className="px-4 text-slate-400">{p.department || <span className="text-slate-600">-</span>}</td>
                <td className="px-4">
                  <div className="flex justify-end gap-2">
                    {isAdmin && (
                      <>
                        <button onClick={() => edit(p)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(p)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Personel bulunamadı</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
