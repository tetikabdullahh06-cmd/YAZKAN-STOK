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
  const [detailPerson, setDetailPerson] = useState(null);
  const [detailRows, setDetailRows] = useState({ movements: [], gloves: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFilters, setDetailFilters] = useState({ date_from: "", date_to: "", search: "" });

  const load = () => api.get("/personnel").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openDetails = async (person, filters = detailFilters) => {
    setDetailPerson(person); setDetailLoading(true);
    try {
      const params = { personnel_id: person.id, limit: 5000 };
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const [movementResponse, gloveResponse] = await Promise.all([
        api.get("/movements", { params }),
        api.get("/glove-movements", { params: { personnel_id: person.id } }),
      ]);
      const from = filters.date_from || "0000-00-00";
      const to = filters.date_to || "9999-12-31";
      const gloves = (gloveResponse.data || []).filter((row) => {
        const date = String(row.transaction_date || row.created_at || "").slice(0, 10);
        return date >= from && date <= to;
      });
      setDetailRows({ movements: movementResponse.data || [], gloves });
    } catch (e) { toast.error(e.response?.data?.detail || "Personel kullanım detayları yüklenemedi"); }
    finally { setDetailLoading(false); }
  };

  const filteredDetailRows = (() => {
    const s = detailFilters.search.trim().toLocaleLowerCase("tr-TR");
    if (!s) return detailRows;
    const matches = (row) => `${row.product_code || ""} ${row.product_name || ""} ${row.machine_name || ""} ${row.machine_code || ""} ${row.glove_name || ""} ${row.brand || ""} ${row.category || ""}`.toLocaleLowerCase("tr-TR").includes(s);
    return { movements: detailRows.movements.filter(matches), gloves: detailRows.gloves.filter(matches) };
  })();

  const exportDetails = () => {
    if (!detailPerson) return;
    const personName = `${detailPerson.first_name} ${detailPerson.last_name}`;
    const rows = [
      ...filteredDetailRows.movements.map((row) => ({
        "Tarih": row.transaction_date || String(row.created_at || "").slice(0, 10),
        "Kayıt Türü": "Kesici uç / stok kullanımı",
        "Ürün Kodu": row.product_code || "",
        "Ürün / Elmas Uç": row.product_name || "",
        "Tezgah": row.machine_name || row.machine_code || "",
        "Miktar": row.quantity ?? 0,
        "Birim": row.unit || "adet",
        "Eldiven": "",
        "Not": row.production_product || row.exit_reason || row.note || "",
      })),
      ...filteredDetailRows.gloves.map((row) => ({
        "Tarih": row.transaction_date || String(row.created_at || "").slice(0, 10),
        "Kayıt Türü": "Eldiven kullanımı",
        "Ürün Kodu": "",
        "Ürün / Elmas Uç": "",
        "Tezgah": "",
        "Miktar": row.quantity ?? 0,
        "Birim": row.unit || "çift",
        "Eldiven": `${row.glove_name || ""}${row.size ? ` (${row.size})` : ""}${row.brand ? ` — ${row.brand}` : ""}`,
        "Not": row.note || "",
      })),
    ].sort((a, b) => String(b["Tarih"]).localeCompare(String(a["Tarih"])));
    if (!rows.length) return toast.info("Seçilen filtrelerde dışa aktarılacak detay yok");
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kullanım Detayları");
    XLSX.writeFile(wb, `YAZKAN-${personName.replace(/\s+/g, "-")}-kullanim-detaylari-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} kullanım detayı Excel'e aktarıldı`);
  };

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

      {detailPerson && (
        <section className="bg-white border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-blue-200 bg-blue-50 flex items-center justify-between gap-3 flex-wrap">
            <div><div className="text-xs uppercase tracking-widest font-black text-blue-700">Personel kullanım detayları</div><h2 className="text-xl font-black text-slate-950">{detailPerson.first_name} {detailPerson.last_name}</h2><div className="text-sm text-slate-600">{detailPerson.department || "Görev belirtilmemiş"}</div></div>
            <button type="button" onClick={() => setDetailPerson(null)} className="h-10 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold">Detayı Kapat</button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="text-xs font-bold text-slate-700">Başlangıç tarihi<input type="date" value={detailFilters.date_from} max={detailFilters.date_to || undefined} onChange={(e) => setDetailFilters({ ...detailFilters, date_from: e.target.value })} className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3" /></label>
              <label className="text-xs font-bold text-slate-700">Bitiş tarihi<input type="date" value={detailFilters.date_to} min={detailFilters.date_from || undefined} onChange={(e) => setDetailFilters({ ...detailFilters, date_to: e.target.value })} className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3" /></label>
              <label className="text-xs font-bold text-slate-700">Detaylarda ara<input value={detailFilters.search} onChange={(e) => setDetailFilters({ ...detailFilters, search: e.target.value })} placeholder="Elmas uç, ürün, tezgah, eldiven..." className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3" /></label>
              <div className="flex gap-2"><button type="button" onClick={() => openDetails(detailPerson)} className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">Filtrele</button><button type="button" onClick={exportDetails} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"><Download className="w-4 h-4 inline mr-1" />Excel</button></div>
            </div>
            {detailLoading ? <div className="py-8 text-center font-bold text-slate-600">Kullanım detayları yükleniyor...</div> : <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className="rounded-xl bg-blue-50 border border-blue-200 p-4"><div className="text-xs font-bold text-blue-700">Kesici uç / elmas uç kullanımı</div><div className="text-2xl font-black text-slate-950">{filteredDetailRows.movements.reduce((n, row) => n + Number(row.quantity || 0), 0)}</div></div><div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4"><div className="text-xs font-bold text-emerald-700">Eldiven kullanımı</div><div className="text-2xl font-black text-slate-950">{filteredDetailRows.gloves.reduce((n, row) => n + Number(row.quantity || 0), 0)} çift</div></div><div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><div className="text-xs font-bold text-slate-700">Kayıt sayısı</div><div className="text-2xl font-black text-slate-950">{filteredDetailRows.movements.length + filteredDetailRows.gloves.length}</div></div></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-700 border-b border-slate-200"><th className="p-3">Tarih</th><th className="p-3">Kayıt</th><th className="p-3">Ürün / Elmas uç</th><th className="p-3">Tezgah</th><th className="p-3">Eldiven</th><th className="p-3 text-right">Miktar</th><th className="p-3">Açıklama</th></tr></thead><tbody>
                {filteredDetailRows.movements.map((row) => <tr key={`m-${row.id}`} className="border-b border-slate-100"><td className="p-3">{row.transaction_date || String(row.created_at || "").slice(0, 10) || "-"}</td><td className="p-3 font-bold text-blue-700">Kesici uç / stok</td><td className="p-3"><b>{row.product_code || "-"}</b><div>{row.product_name || "-"}</div></td><td className="p-3">{row.machine_name || row.machine_code || "-"}</td><td className="p-3">-</td><td className="p-3 text-right font-black">{row.quantity ?? 0} {row.unit || "adet"}</td><td className="p-3">{row.production_product || row.exit_reason || row.note || "-"}</td></tr>)}
                {filteredDetailRows.gloves.map((row) => <tr key={`g-${row.id}`} className="border-b border-slate-100"><td className="p-3">{row.transaction_date || String(row.created_at || "").slice(0, 10) || "-"}</td><td className="p-3 font-bold text-emerald-700">Eldiven</td><td className="p-3">-</td><td className="p-3">-</td><td className="p-3">{row.glove_name || "-"}{row.size ? ` (${row.size})` : ""}{row.brand ? ` — ${row.brand}` : ""}</td><td className="p-3 text-right font-black">{row.quantity ?? 0} {row.unit || "çift"}</td><td className="p-3">{row.note || "-"}</td></tr>)}
                {!filteredDetailRows.movements.length && !filteredDetailRows.gloves.length && <tr><td colSpan={7} className="p-8 text-center font-bold text-slate-600">Seçilen filtrelerde kullanım detayı bulunamadı.</td></tr>}
              </tbody></table></div>
            </>}
          </div>
        </section>
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
                <td className="px-4 font-medium"><button type="button" onClick={() => openDetails(p)} className="text-left font-black text-blue-700 hover:text-blue-900 hover:underline">{p.first_name} {p.last_name}</button><ImageHover src={p.image_url} alt={`${p.first_name} ${p.last_name}`} /><div className="text-xs text-slate-500">Kullanım detaylarını görüntüle</div></td>
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
