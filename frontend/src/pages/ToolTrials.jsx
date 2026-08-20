import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { BarChart3, Download, FileSpreadsheet, Loader2, Plus, Search, Trash2, Trophy, Upload } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const input = "w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 outline-none focus:ring-2 focus:ring-blue-500";
const label = "block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider";
const blank = { comparison_name: "", trial_date: today(), part_name: "", material: "", hardness: "", machine_id: "", operation_type: "Tornalama", product_id: "", product_brand: "", product_code: "", insert_grade: "", tool_diameter: "", quantity_used: "", price: "", spindle_speed: "", cutting_speed: "", feed_rate: "", depth_of_cut: "", drill_diameter: "", feed_per_tooth: "", runtime_minutes: "", parts_machined: "", wear_result: "", result: "", technical_comment: "", coolant: "" };
const PRESET_SETS = { Tornalama: [{ id: "turn-rough", label: "Karbür uç — kaba tornalama", values: { tool_diameter: "20 mm", spindle_speed: "1200 dev/dk", cutting_speed: "150 m/dk", feed_rate: "0.20 mm/dev", depth_of_cut: "2 mm", coolant: "Emülsiyon" } }, { id: "turn-finish", label: "Karbür uç — finiş tornalama", values: { tool_diameter: "12 mm", spindle_speed: "1800 dev/dk", cutting_speed: "220 m/dk", feed_rate: "0.08 mm/dev", depth_of_cut: "0.5 mm", coolant: "Emülsiyon" } }, { id: "turn-stainless", label: "Paslanmaz — kontrollü başlangıç", values: { tool_diameter: "16 mm", spindle_speed: "900 dev/dk", cutting_speed: "90 m/dk", feed_rate: "0.12 mm/dev", depth_of_cut: "1 mm", coolant: "Bol emülsiyon" } }], Frezeleme: [{ id: "mill-rough", label: "Parmak freze — kaba frezeleme", values: { tool_diameter: "10 mm", spindle_speed: "3000 dev/dk", cutting_speed: "95 m/dk", feed_rate: "600 mm/dk", depth_of_cut: "2 mm", feed_per_tooth: "0.05 mm/diş", coolant: "Emülsiyon" } }, { id: "mill-finish", label: "Parmak freze — finiş frezeleme", values: { tool_diameter: "8 mm", spindle_speed: "4500 dev/dk", cutting_speed: "113 m/dk", feed_rate: "360 mm/dk", depth_of_cut: "0.5 mm", feed_per_tooth: "0.03 mm/diş", coolant: "Hava / sis" } }, { id: "mill-aluminium", label: "Alüminyum — yüksek devir başlangıcı", values: { tool_diameter: "6 mm", spindle_speed: "8000 dev/dk", cutting_speed: "150 m/dk", feed_rate: "960 mm/dk", depth_of_cut: "1 mm", feed_per_tooth: "0.04 mm/diş", coolant: "Hava" } }] };

export default function ToolTrials() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]), [machines, setMachines] = useState([]), [trials, setTrials] = useState([]), [form, setForm] = useState(blank), [query, setQuery] = useState(""), [productQuery, setProductQuery] = useState(""), [showNewProduct, setShowNewProduct] = useState(false), [newProduct, setNewProduct] = useState({ code: "", name: "", brand: "", quality: "", category: "Kesici Uç", unit: "adet", current_stock: 0, min_stock: 0 }), [presetId, setPresetId] = useState(""), [saving, setSaving] = useState(false);
  const load = async () => { try { const [p, m, t] = await Promise.all([api.get("/products"), api.get("/machines"), api.get("/tool-trials")]); setProducts(p.data); setMachines(m.data); setTrials(t.data); } catch (e) { toast.error(e.response?.data?.detail || "Denemeler yüklenemedi"); } };
  useEffect(() => { load(); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const applyPreset = (id) => { setPresetId(id); const preset = (PRESET_SETS[form.operation_type] || []).find((x) => x.id === id); if (preset) setForm((f) => ({ ...f, ...preset.values })); };
  const selected = products.find((p) => p.id === form.product_id);
  const productOptions = products.filter((p) => { const q = productQuery.toLowerCase().trim(); return !q || `${p.code || ""} ${p.name || ""} ${p.brand || ""} ${p.quality || ""}`.toLowerCase().includes(q); });
  const addNewProduct = async () => { if (!newProduct.name.trim()) return toast.error("Ürün/uç adı zorunludur"); try { const r = await api.post("/products", { ...newProduct, current_stock: Number(newProduct.current_stock) || 0, min_stock: Number(newProduct.min_stock) || 0, is_special: true }); setProducts((items) => [r.data, ...items]); setForm((f) => ({ ...f, product_id: r.data.id, product_brand: r.data.brand || "", product_code: r.data.code || "" })); setProductQuery(r.data.name || ""); setShowNewProduct(false); setNewProduct({ code: "", name: "", brand: "", quality: "", category: "Kesici Uç", unit: "adet", current_stock: 0, min_stock: 0 }); toast.success("Yeni uç ürün kataloğuna eklendi ve seçildi"); } catch (e) { toast.error(e.response?.data?.detail || "Ürün eklenemedi"); } };
  const filtered = useMemo(() => { const q = query.toLowerCase(); return trials.filter((t) => !q || `${t.comparison_name} ${t.part_name} ${t.product_brand} ${t.product_code} ${t.insert_grade}`.toLowerCase().includes(q)); }, [trials, query]);
  const submit = async (e) => { e.preventDefault(); setSaving(true); try { await api.post("/tool-trials", { ...form, product_brand: selected?.brand || form.product_brand, product_code: selected?.code || form.product_code, quantity_used: Number(form.quantity_used) || 0, price: Number(form.price) || 0, runtime_minutes: Number(form.runtime_minutes) || 0, parts_machined: Number(form.parts_machined) || 0, machine_id: form.machine_id || null, product_id: form.product_id || null }); toast.success("Deneme raporu kaydedildi"); setForm(blank); await load(); } catch (e) { toast.error(e.response?.data?.detail || "Deneme kaydedilemedi"); } finally { setSaving(false); } };
  const remove = async (id) => { if (!window.confirm("Bu deneme silinsin mi?")) return; try { await api.delete(`/tool-trials/${id}`); load(); } catch (e) { toast.error(e.response?.data?.detail || "Silinemedi"); } };
  const grouped = Object.values(filtered.reduce((a, t) => { const k = t.comparison_name || "Grupsuz"; (a[k] ||= []).push(t); return a; }, {}));
  const exportRows = (rows) => rows.map((t) => ({
    "Karşılaştırma Grubu": t.comparison_name || "",
    "Tarih": t.trial_date || "",
    "İşlenen Ürün / Parça": t.part_name || "",
    "Malzeme": t.material || "",
    "Sertlik": t.hardness || "",
    "Tezgâh": t.machine_name || "",
    "İş Türü": t.operation_type || "",
    "Marka": t.product_brand || "",
    "Ürün / Uç Kodu": t.product_code || "",
    "Uç Kodu ve Kalite": t.insert_grade || "",
    "Takım Çapı": t.tool_diameter || "",
    "Devir N": t.spindle_speed || "",
    "Kesme Hızı Vc": t.cutting_speed || "",
    "İlerleme F": t.feed_rate || "",
    "Paso ap": t.depth_of_cut || "",
    "Matkap Çapı": t.drill_diameter || "",
    "Diş Başı fz": t.feed_per_tooth || "",
    "Soğutma": t.coolant || "",
    "Kullanılan Miktar": t.quantity_used ?? 0,
    "Birim Fiyat": t.price ?? 0,
    "Çalışma Süresi (dk)": t.runtime_minutes ?? 0,
    "İşlenen Parça Adedi": t.parts_machined ?? 0,
    "Aşınma / Takım Ömrü": t.wear_result || "",
    "Test Sonucu": t.result || "",
    "Teknik Yorum": t.technical_comment || "",
  }));
  const downloadWorkbook = (rows, filename) => {
    const ws = XLSX.utils.json_to_sheet(exportRows(rows));
    ws["!cols"] = Object.keys(exportRows(rows)[0] || {}).map((key) => ({ wch: Math.max(14, Math.min(32, key.length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Deneme Raporları");
    XLSX.writeFile(wb, filename);
  };
  const exportExcel = () => {
    downloadWorkbook(filtered, `kesici-takim-denemeleri-${query.trim() ? "filtreli" : "tam-liste"}-${today()}.xlsx`);
    toast.success(`${filtered.length} deneme Excel'e aktarıldı`);
  };
  const downloadTemplate = () => {
    const sample = { "Karşılaştırma Grubu": "Örnek Karşılaştırma", "Tarih": today(), "İşlenen Ürün / Parça": "Örnek Parça", "Malzeme": "GG25", "Sertlik": "180 HB", "Tezgâh": "Tezgâh kodu veya adı", "İş Türü": "Tornalama", "Marka": "Örnek Marka", "Ürün / Uç Kodu": "UÇ-001", "Uç Kodu ve Kalite": "CNMG 120408", "Takım Çapı": "20 mm", "Devir N": "1200 dev/dk", "Kesme Hızı Vc": "150 m/dk", "İlerleme F": "0.20 mm/dev", "Paso ap": "2 mm", "Soğutma": "Emülsiyon", "Kullanılan Miktar": 1, "Birim Fiyat": 0, "Çalışma Süresi (dk)": 30, "İşlenen Parça Adedi": 10, "Aşınma / Takım Ömrü": "Örnek aşınma", "Test Sonucu": "Başarılı", "Teknik Yorum": "Şablon satırı; kendi verilerinle değiştir." };
    const ws = XLSX.utils.json_to_sheet([sample]);
    ws["!cols"] = Object.keys(sample).map((key) => ({ wch: Math.max(14, Math.min(30, key.length + 4)) }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Deneme Şablonu");
    XLSX.writeFile(wb, "kesici-takim-deneme-sablonu.xlsx");
    toast.success("Örnek Excel şablonu indirildi");
  };
  const importExcel = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const rows = XLSX.utils.sheet_to_json(XLSX.read(data, { type: "array" }).Sheets[XLSX.read(data, { type: "array" }).SheetNames[0]], { defval: "" });
      if (!rows.length) return toast.error("Excel dosyasında kayıt bulunamadı");
      setSaving(true);
      const keyMap = { "Karşılaştırma Grubu":"comparison_name", "Tarih":"trial_date", "İşlenen Ürün / Parça":"part_name", "Malzeme":"material", "Sertlik":"hardness", "Tezgâh":"machine_id", "İş Türü":"operation_type", "Marka":"product_brand", "Ürün / Uç Kodu":"product_code", "Uç Kodu ve Kalite":"insert_grade", "Takım Çapı":"tool_diameter", "Devir N":"spindle_speed", "Kesme Hızı Vc":"cutting_speed", "İlerleme F":"feed_rate", "Paso ap":"depth_of_cut", "Matkap Çapı":"drill_diameter", "Diş Başı fz":"feed_per_tooth", "Soğutma":"coolant", "Kullanılan Miktar":"quantity_used", "Birim Fiyat":"price", "Çalışma Süresi (dk)":"runtime_minutes", "İşlenen Parça Adedi":"parts_machined", "Aşınma / Takım Ömrü":"wear_result", "Test Sonucu":"result", "Teknik Yorum":"technical_comment" };
      let count = 0;
      for (const row of rows) { const payload = {}; Object.entries(row).forEach(([k, v]) => { const target = keyMap[k] || k; payload[target] = v; }); payload.quantity_used = Number(payload.quantity_used) || 0; payload.price = Number(payload.price) || 0; payload.runtime_minutes = Number(payload.runtime_minutes) || 0; payload.parts_machined = Number(payload.parts_machined) || 0; const matchedMachine = machines.find((m) => payload.machine_id && (m.id === payload.machine_id || m.code === payload.machine_id || m.name === payload.machine_id)); payload.machine_id = matchedMachine?.id || null; const matchedProduct = products.find((p) => payload.product_code && p.code === payload.product_code); payload.product_id = matchedProduct?.id || null; await api.post("/tool-trials", payload); count += 1; }
      toast.success(`${count} deneme kaydı içe aktarıldı`); await load();
    } catch (err) { toast.error(err.response?.data?.detail || "Excel içe aktarılamadı"); } finally { setSaving(false); }
  };
  return <div className="space-y-6"><div className="flex items-end justify-between flex-wrap gap-4"><div><div className="text-xs text-blue-400 uppercase tracking-[.2em] font-semibold mb-2">Kesici Takım Performansı</div><h1 className="font-display text-4xl font-black">Deneme ve Marka Karşılaştırma</h1><p className="text-slate-400 mt-1">Matkap, freze ve kesici elmas uç denemelerini aynı iş ve parametre grubu içinde karşılaştırın.</p></div><div className="flex gap-2 flex-wrap"><button type="button" onClick={downloadTemplate} className="h-11 px-4 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> Örnek Şablon</button><button type="button" onClick={exportExcel} className="h-11 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center gap-2"><Download className="w-4 h-4"/> Dışa Aktar</button><label className="h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-semibold flex items-center gap-2 cursor-pointer"><Upload className="w-4 h-4"/> İçe Aktar<input id="tool-trials-excel-input" type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden"/></label></div></div>
    <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5"><div className="flex items-center gap-2 text-blue-300 font-semibold"><BarChart3 className="w-5 h-5" />Deneme raporu kartı</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[["comparison_name","Karşılaştırma grubu","Örn. DNMG 150608 - Döküm"],["trial_date","Tarih",""],["part_name","İşlenen ürün / parça",""],["material","Malzeme ve sertlik","Örn. GG25 / 180 HB"]].map(([k,l,p])=><div key={k}><label className={label}>{l}</label><input required={k !== "comparison_name"} type={k === "trial_date" ? "date" : "text"} value={form[k]} placeholder={p} onChange={e=>set(k,e.target.value)} className={input}/></div>)}</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><label className={label}>Tezgâh</label><select value={form.machine_id} onChange={e=>set("machine_id",e.target.value)} className={input}><option value="">Seçin</option>{machines.map(m=><option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}</select></div><div><label className={label}>İş türü</label><select value={form.operation_type} onChange={e=>{set("operation_type",e.target.value);setPresetId("")}} className={input}>{["Tornalama","Frezeleme","Delme","Diş açma","Diğer"].map(x=><option key={x}>{x}</option>)}</select></div><div><label className={label}>Hazır parametre seti</label><select value={presetId} onChange={e=>applyPreset(e.target.value)} className={input}><option value="">Elle gireceğim</option>{(PRESET_SETS[form.operation_type] || []).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div><div><label className={label}>Stoktaki ürün / uç</label><div className="flex gap-2"><input value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder="Kod, ad, marka veya kalite ara..." className={input}/>{isAdmin && <button type="button" onClick={()=>setShowNewProduct((v)=>!v)} title="Stokta yoksa yeni uç ekle" className="h-11 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"><Plus className="w-5 h-5"/></button>}</div><select value={form.product_id} onChange={e=>{ const id=e.target.value; set("product_id",id); const p=products.find(x=>x.id===id); if(p){setProductQuery(`${p.code || ""} — ${p.name}`); set("product_brand",p.brand || ""); set("product_code",p.code || "");} }} className={`${input} mt-2`}><option value="">Ürün seçmeden elle gireceğim</option>{productOptions.map(p=><option key={p.id} value={p.id}>{p.code} — {p.name} | Stok: {p.current_stock}</option>)}</select>{showNewProduct && isAdmin && <div className="mt-2 p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 space-y-2"><div className="text-xs text-emerald-300 font-semibold">Stokta olmayan uç için ürün ekle</div><div className="grid grid-cols-2 gap-2"><input value={newProduct.name} onChange={e=>setNewProduct({...newProduct,name:e.target.value})} placeholder="Uç / ürün adı" className={input}/><input value={newProduct.code} onChange={e=>setNewProduct({...newProduct,code:e.target.value})} placeholder="Kod (opsiyonel)" className={input}/><input value={newProduct.brand} onChange={e=>setNewProduct({...newProduct,brand:e.target.value})} placeholder="Marka" className={input}/><input value={newProduct.quality} onChange={e=>setNewProduct({...newProduct,quality:e.target.value})} placeholder="Kalite" className={input}/><input type="number" min="0" value={newProduct.current_stock} onChange={e=>setNewProduct({...newProduct,current_stock:e.target.value})} placeholder="Mevcut stok" className={input}/></div><button type="button" onClick={addNewProduct} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-bold">Ürünü Ekle ve Seç</button></div>}</div><div><label className={label}>Marka</label><input value={selected?.brand || form.product_brand} onChange={e=>set("product_brand",e.target.value)} className={input}/></div></div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">{[["product_code","Ürün / uç kodu"],["insert_grade","Uç kodu ve kalite"],["tool_diameter","Takım çapı"],["spindle_speed","Devir N"],["cutting_speed","Kesme hızı Vc"],["feed_rate","İlerleme F"],["depth_of_cut","Paso ap"],["drill_diameter","Matkap çapı"],["feed_per_tooth","Diş başı fz"],["coolant","Soğutma"],["quantity_used","Kullanılan miktar"],["price","Birim fiyat"]].map(([k,l])=><div key={k}><label className={label}>{l}</label><input value={form[k]} onChange={e=>set(k,e.target.value)} className={input}/></div>)}</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[["runtime_minutes","Çalışma süresi (dk)"],["parts_machined","İşlenen parça adedi"],["wear_result","Aşınma / takım ömrü"],["result","Test sonucu"],["technical_comment","Teknik yorum"]].map(([k,l])=><div key={k} className={k === "technical_comment" ? "md:col-span-2" : ""}><label className={label}>{l}</label><input value={form[k]} onChange={e=>set(k,e.target.value)} className={input}/></div>)}</div>
      <button disabled={saving} className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>} Deneme Kaydet</button>
    </form>
    <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Marka, uç kodu, parça veya karşılaştırma ara..." className={`${input} pl-10`}/></div>
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-700 flex gap-2 items-center"><Trophy className="w-5 h-5 text-amber-300"/><h2 className="font-bold">Karşılaştırmalı sonuçlar</h2></div>{grouped.map((rows,i)=><div key={i} className="p-5 border-b border-slate-800"><h3 className="font-semibold text-blue-300 mb-3">{rows[0].comparison_name || "Grupsuz"}</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="p-2">Marka / Kod</th><th className="p-2">İş türü</th><th className="p-2">Vc / F / ap</th><th className="p-2">Parça</th><th className="p-2">Süre</th><th className="p-2">Sonuç</th><th/></tr></thead><tbody>{rows.map(t=><tr key={t.id} className="border-t border-slate-800"><td className="p-2">{t.product_brand || "-"}<div className="text-slate-500">{t.product_code || t.insert_grade}</div></td><td className="p-2">{t.operation_type}</td><td className="p-2">{t.cutting_speed || "-"} / {t.feed_rate || "-"} / {t.depth_of_cut || "-"}</td><td className="p-2 font-bold text-emerald-300">{t.parts_machined || 0}</td><td className="p-2">{t.runtime_minutes || 0} dk</td><td className="p-2">{t.result || t.wear_result || "-"}</td><td className="p-2"><button onClick={()=>remove(t.id)} className="text-slate-500 hover:text-red-300"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody></table></div></div>)}</div>
  </div>;
}
