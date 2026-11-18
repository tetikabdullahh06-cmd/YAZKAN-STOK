import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import * as XLSX from "xlsx";
import { downloadRecipeCard } from "@/lib/recipeCardExport";
import { CARD_DEFAULTS, LINE_DEFAULTS, norm, dateISO, cardDate, groupRecipeLines, parseDetailRows, parseCardMatrix } from "@/lib/recipeCardData";
import { toast } from "sonner";
import { Cable, CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, Search, Trash2, Upload, Pencil } from "lucide-react";

const input = "w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 outline-none focus:ring-2 focus:ring-violet-500";
const label = "block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider";
const emptyCard = { ...CARD_DEFAULTS, publication_date: cardDate(CARD_DEFAULTS.publication_date) };
const emptyParams = { machining_length: "", cutting_speed: "", spindle_speed: "", feed_rate: "", ...LINE_DEFAULTS };
const technicalFields = [
  ["tool_no", "Takım no / tezgâh sıra no", "Boşsa otomatik sıralanır"],
  ["machining_length", "Takım işleme boyu", "mm"],
  ["cutting_speed", "Kesme hızı", "m/dk"],
  ["spindle_speed", "Devir (N)", "dev/dk"],
  ["feed_rate", "İlerleme (F)", "mm/dk"],
  ["drill_helix_length", "Matkap helis boyu", "mm"],
  ["insert_brand", "İnsert markası", ""],
  ["used_insert", "Kullanılan insert", "Kesici elmas kodu"],
  ["insert_quality", "İnsert kalitesi", ""],
  ["tool_life", "Takım ömrü", "adet"],
  ["special", "Özel / açıklama", ""],
];

function Field({ field, title, value, onChange, placeholder = "", ...props }) {
  return <div><label htmlFor={field} className={label}>{title}</label><input id={field} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} {...props}/></div>;
}
function SearchSelect({ labelText, value, onChange, search, setSearch, items, placeholder, field }) {
  const filtered = useMemo(() => items.filter((x) => x.id === value || !norm(search) || norm(`${x.code || ""} ${x.name || ""} ${x.brand || ""}`).includes(norm(search))), [items, search, value]);
  return <div><label htmlFor={field} className={label}>{labelText}</label><div className="relative mb-2"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-500"/><input aria-label={`${labelText} arama`} value={search} onChange={(e) => setSearch(e.target.value)} className={`${input} pl-9`} placeholder={placeholder}/></div><select id={field} value={value} onChange={(e) => onChange(e.target.value)} className={input}><option value="">Seçin</option>{filtered.map((x) => <option key={x.id} value={x.id}>{x.code ? `${x.code} — ` : ""}{x.name}{x.brand ? ` | ${x.brand}` : ""} | Stok: {x.current_stock ?? 0}</option>)}</select></div>;
}

export default function Recipes() {
  const [products, setProducts] = useState([]), [holders, setHolders] = useState([]), [machines, setMachines] = useState([]), [recipes, setRecipes] = useState([]);
  const [name, setName] = useState(""), [workpiece, setWorkpiece] = useState(""), [note, setNote] = useState("");
  const [card, setCard] = useState(emptyCard), [params, setParams] = useState(emptyParams);
  const [productRef, setProductRef] = useState(""), [holderRef, setHolderRef] = useState(""), [productQty, setProductQty] = useState("1"), [holderQty, setHolderQty] = useState("1");
  const [productSearch, setProductSearch] = useState(""), [holderSearch, setHolderSearch] = useState(""), [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false), [exporting, setExporting] = useState(false), [bindFor, setBindFor] = useState(""), [machine, setMachine] = useState(""), [selectedRecipeId, setSelectedRecipeId] = useState(""), [editId, setEditId] = useState(null), [lineEditId, setLineEditId] = useState(null), [importWarnings, setImportWarnings] = useState([]);
  const setCardValue = (key, value) => setCard((prev) => ({ ...prev, [key]: value }));
  const setParam = (key, value) => setParams((prev) => ({ ...prev, [key]: value }));
  const load = async () => { try { const [p, h, m, r] = await Promise.all([api.get("/products"), api.get("/toolholders"), api.get("/machines"), api.get("/recipes")]); setProducts(p.data); setHolders(h.data); setMachines(m.data); setRecipes(r.data); } catch (e) { toast.error(e.response?.data?.detail || "Reçeteler yüklenemedi"); } };
  useEffect(() => { load(); }, []);

  const clearLineForm = () => { setProductRef(""); setHolderRef(""); setProductSearch(""); setHolderSearch(""); setProductQty("1"); setHolderQty("1"); setParams(emptyParams); setLineEditId(null); };
  const handleProductSelect = (id) => {
    setProductRef(id); const p = products.find((x) => x.id === id);
    setParams((prev) => ({ ...prev, cutting_speed: p?.cutting_speed || "", spindle_speed: p?.spindle_speed || "", feed_rate: p?.feed_rate || "", used_insert: p?.used_diamond_code || "" }));
  };
  const handleHolderSelect = (id) => { setHolderRef(id); const h = holders.find((x) => x.id === id); setParams((prev) => ({ ...prev, holder_type: h?.type || "", holder_length: h?.length || "" })); };
  const addPair = () => {
    const p = products.find((x) => x.id === productRef), h = holders.find((x) => x.id === holderRef);
    if (!p) return toast.error("Reçeteye eklenecek takımı seçin");
    const pq = Number(productQty), hq = Number(holderQty);
    if (!Number.isFinite(pq) || pq <= 0) return toast.error("Takım miktarı 0'dan büyük olmalıdır");
    if (holderRef && (!Number.isFinite(hq) || hq <= 0)) return toast.error("Tutucu miktarı 0'dan büyük olmalıdır");
    const pairId = lineEditId || `pair-${Date.now()}`;
    const old = lines.find((l) => l.pairId === pairId);
    const pair = { pairId, product: { ...(old?.product || {}), kind: "product", pair_id: pairId, reference_id: p.id, name: p.name, code: p.code || "", quantity: pq, brand: p.brand || "", ...params }, holder: h ? { ...(old?.holder || {}), kind: "toolholder", pair_id: pairId, reference_id: h.id, name: h.name, code: h.code || "", quantity: hq, brand: h.brand || "" } : null };
    setLines((prev) => lineEditId ? prev.map((l) => l.pairId === pairId ? pair : l) : [...prev, pair]); clearLineForm();
  };
  const editLine = (line) => { setProductRef(line.product.reference_id); setHolderRef(line.holder?.reference_id || ""); setProductQty(String(line.product.quantity)); setHolderQty(String(line.holder?.quantity || 1)); setProductSearch(""); setHolderSearch(""); setParams(Object.fromEntries(Object.keys(emptyParams).map((key) => [key, line.product[key] ?? ""]))); setLineEditId(line.pairId); document.getElementById("recipe-tool-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const resetRecipeForm = () => { setName(""); setWorkpiece(""); setNote(""); setCard(emptyCard); setLines([]); setEditId(null); setImportWarnings([]); clearLineForm(); };
  const create = async (e) => {
    e.preventDefault(); if (!name.trim() || !workpiece.trim()) return toast.error("Reçete adı ve parça adı zorunlu");
    if (!lines.length) return toast.error("En az bir takım satırı ekleyin");
    if (lineEditId || productRef) return toast.error("Önce seçtiğiniz takım satırını ekleyin/güncelleyin ya da satır seçimini iptal edin");
    for (const key of ["publication_date", "revision_date"]) if (card[key] && !dateISO(card[key])) return toast.error("Tarihleri GG/AA/YY biçiminde girin");
    setSaving(true);
    try { const payload = { name: name.trim(), workpiece_name: workpiece.trim(), note, ...card, publication_date: dateISO(card.publication_date), revision_date: dateISO(card.revision_date), lines: lines.flatMap((x) => x.holder ? [x.product, x.holder] : [x.product]) }; if (editId) { await api.put(`/recipes/${editId}`, payload); toast.success("Reçete güncellendi"); } else { await api.post("/recipes", payload); toast.success("Reçete oluşturuldu; stok henüz düşmedi"); } resetRecipeForm(); await load(); } catch (err) { toast.error(err.response?.data?.detail || "Reçete kaydedilemedi"); } finally { setSaving(false); }
  };
  const editRecipe = (recipe) => { if (recipe.status === "bound") return toast.info("Tezgâha bağlanmış reçete düzenlenemez"); clearLineForm(); setName(recipe.name || ""); setWorkpiece(recipe.workpiece_name || ""); setNote(recipe.note || ""); setCard({ ...Object.fromEntries(Object.keys(CARD_DEFAULTS).map((key) => [key, recipe[key] ?? CARD_DEFAULTS[key]])), publication_date: cardDate(recipe.publication_date ?? CARD_DEFAULTS.publication_date), revision_date: cardDate(recipe.revision_date) }); setLines(groupRecipeLines(recipe.lines)); setEditId(recipe.id); setImportWarnings([]); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const deleteRecipe = async (recipe) => { if (recipe.status === "bound") return toast.info("Tezgâha bağlanmış reçete silinemez"); if (!window.confirm(`"${recipe.name}" reçetesi silinsin mi?`)) return; try { await api.delete(`/recipes/${recipe.id}`); if (editId === recipe.id) resetRecipeForm(); if (selectedRecipeId === recipe.id) setSelectedRecipeId(""); toast.success("Reçete silindi"); await load(); } catch (e) { toast.error(e.response?.data?.detail || "Reçete silinemedi"); } };
  const bind = async () => { if (!bindFor || !machine) return toast.error("Reçete ve tezgâh seçin"); if (!window.confirm("Reçetedeki ürün ve takım tutucu kalemleri stoktan düşülüp tezgâha bağlanacak. Devam edilsin mi?")) return; setSaving(true); try { await api.post(`/recipes/${bindFor}/bind`, { machine_id: machine }); toast.success("Reçete tezgâha bağlandı; ürün ve tutucu stokları düşüldü"); setBindFor(""); setMachine(""); await load(); } catch (e) { toast.error(e.response?.data?.detail || "Reçete bağlanamadı"); } finally { setSaving(false); } };
  const exportExcel = async (recipeId = selectedRecipeId) => {
    if (!recipeId) return toast.info("Önce Excel'e aktarılacak reçeteyi seçin"); const recipe = recipes.find((r) => r.id === recipeId); if (!recipe) return toast.info("Seçilen reçete bulunamadı");
    setExporting(true); try { await downloadRecipeCard({ recipe, groups: groupRecipeLines(recipe.lines), filename: `F-165-${(recipe.workpiece_name || recipe.name || "takim-karti").replace(/[^\w\-çğıöşüÇĞİÖŞÜ]+/g, "-")}.xlsx` }); toast.success("F-165 kartı ve tüm reçete verileri Excel'e aktarıldı"); } catch (e) { toast.error(e.message || "Excel oluşturulamadı"); } finally { setExporting(false); }
  };
  const template = async () => { setExporting(true); try { await downloadRecipeCard({ recipe: { ...CARD_DEFAULTS }, groups: [], filename: "F-165-takim-karti-recete-sablonu.xlsx" }); toast.success("F-165 boş reçete şablonu indirildi"); } catch (e) { toast.error(e.message || "Şablon indirilemedi"); } finally { setExporting(false); } };
  const importExcel = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    if ((lines.length || name || workpiece) && !window.confirm("Excel'deki reçete mevcut formun yerine doldurulacak. Kaydedilmiş reçeteler ve stok değişmez. Devam edilsin mi?")) return;
    setSaving(true);
    try {
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const dataSheet = book.Sheets["Reçete Verileri"];
      let parsed;
      const firstRows = XLSX.utils.sheet_to_json(dataSheet || book.Sheets[book.SheetNames[0]], { defval: "", raw: false, dateNF: "dd/mm/yy" });
      if (dataSheet || firstRows[0]?.["Takım Kodu"] !== undefined || firstRows[0]?.["Takım Adı"] !== undefined) {
        const names = new Set(firstRows.map((r) => r["Reçete Adı"]).filter(Boolean));
        if (names.size > 1) throw new Error("Tek seferde bir reçetenin Excel'ini seçin");
        parsed = parseDetailRows(firstRows, products, holders);
      } else {
        for (const sheetName of book.SheetNames) {
          const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: "", raw: false });
          const next = parseCardMatrix(matrix, products, holders);
          if (!parsed) parsed = next; else { parsed.groups.push(...next.groups); parsed.warnings.push(...next.warnings); }
        }
      }
      if (!parsed?.groups.length) { setImportWarnings(parsed?.warnings || []); return toast.error("Stokla eşleşen takım bulunamadı. Formunuz değiştirilmedi; listedeki ad ve markaları kontrol edin."); }
      clearLineForm(); setEditId(null); setName(parsed.name || "İçe Aktarılan Reçete"); setWorkpiece(parsed.workpiece); setNote(parsed.note); setCard({ ...parsed.card, publication_date: cardDate(parsed.card.publication_date), revision_date: cardDate(parsed.card.revision_date) }); setLines(parsed.groups); setImportWarnings(parsed.warnings);
      if (parsed.warnings.length) toast.warning(`${parsed.groups.length} satır dolduruldu; ${parsed.warnings.length} eşleşme uyarısını kontrol edin`); else toast.success(`${parsed.groups.length} takım satırı dolduruldu. Kaydetmeden önce kontrol edebilirsiniz; stok değişmedi.`);
    } catch (err) { toast.error(err.message || "Excel içe aktarılamadı"); } finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <div className="flex items-end justify-between flex-wrap gap-4"><div><div className="text-xs text-violet-400 uppercase tracking-[.2em] font-semibold mb-2">İşleme Hazırlığı / F-165</div><h1 className="font-display text-4xl font-black">İşleme Reçeteleri</h1><p className="text-slate-400 mt-1">Parça takım kartını doldurun. Excel çıktısı gönderdiğiniz logo ve F-165 form düzeniyle hazırlanır.</p></div><div className="flex gap-2 flex-wrap"><button type="button" onClick={template} disabled={exporting} className="h-11 px-4 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2 disabled:opacity-50"><FileSpreadsheet className="w-4 h-4"/> F-165 Şablon</button><select aria-label="Excel'e aktarılacak reçete" value={selectedRecipeId} onChange={(e) => setSelectedRecipeId(e.target.value)} className="h-11 max-w-xs bg-slate-950 border border-slate-700 rounded-lg px-3"><option value="">Reçete seçin</option>{recipes.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.workpiece_name}</option>)}</select><button type="button" onClick={() => exportExcel()} disabled={exporting} className="h-11 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50">{exporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} Seçili Reçeteyi Excel’e Aktar</button><label className="h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-semibold flex items-center gap-2 cursor-pointer"><Upload className="w-4 h-4"/> Excel'den Doldur<input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} disabled={saving} className="hidden"/></label></div></div>
    <div className="text-sm text-slate-400">Excel'in ilk sayfası F-165 kartıdır. Kesme hızı, işleme boyu, miktarlar ve diğer tüm bilgiler ayrıca <strong className="text-slate-200">Reçete Verileri</strong> sayfasında korunur. 14 satırdan uzun reçeteler ek kart sayfalarına bölünür.</div>
    {importWarnings.length > 0 && <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 text-sm text-amber-200"><div className="font-bold mb-2">Excel eşleşme uyarıları — yanlış stok kaydı otomatik seçilmez</div>{importWarnings.map((w, i) => <div key={i}>{w}</div>)}</div>}
    <form onSubmit={create} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 text-violet-300 font-semibold"><Cable className="w-5 h-5"/>{editId ? "Reçeteyi düzenle" : "Yeni F-165 reçetesi"}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Field field="recipe-name" title="Reçete adı" required value={name} onChange={setName}/><Field field="recipe-part" title="Parça adı / kodu" required value={workpiece} onChange={setWorkpiece}/>
        <Field field="card-machine-code" title="Makina kodu" list="recipe-machines" value={card.machine_code} onChange={(value) => { const m = machines.find((x) => x.code === value); setCard((prev) => ({ ...prev, machine_code: value, machine_type: m ? m.type || m.name || "" : prev.machine_type })); }}/>
        <datalist id="recipe-machines">{machines.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}</datalist>
        <Field field="card-machine-type" title="Makina tipi" value={card.machine_type} onChange={(v) => setCardValue("machine_type", v)}/>
        <Field field="card-operation" title="Operasyon no" value={card.operation_no} onChange={(v) => setCardValue("operation_no", v)}/>
        <Field field="card-document" title="Doküman no" value={card.document_no} onChange={(v) => setCardValue("document_no", v)}/>
        <Field field="card-publication" title="Yayın tarihi (GG/AA/YY)" placeholder="09/05/25" value={card.publication_date} onChange={(v) => setCardValue("publication_date", v)}/>
        <Field field="card-revision-no" title="Revizyon no" value={card.revision_no} onChange={(v) => setCardValue("revision_no", v)}/>
        <Field field="card-revision-date" title="Revizyon tarihi (GG/AA/YY)" placeholder="GG/AA/YY" value={card.revision_date} onChange={(v) => setCardValue("revision_date", v)}/>
        <Field field="card-prepared" title="Hazırlayan" value={card.prepared_by} onChange={(v) => setCardValue("prepared_by", v)}/>
        <Field field="card-approved" title="Onaylayan" value={card.approved_by} onChange={(v) => setCardValue("approved_by", v)}/>
        <Field field="recipe-note" title="Not / açıklama" value={note} onChange={setNote}/>
      </div>
      <div id="recipe-tool-panel" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-violet-500/40 bg-violet-950/20 p-4 space-y-3"><div className="text-violet-200 font-black">1. Takımı seç {lineEditId && <span className="text-amber-300">— Satır düzenleniyor</span>}</div><SearchSelect field="recipe-product" labelText="Takım ara ve seç (zorunlu)" value={productRef} onChange={handleProductSelect} search={productSearch} setSearch={setProductSearch} items={products} placeholder="Kod, takım adı veya marka yazın"/><div className="text-xs text-emerald-300">Ürün kartındaki kesme hızı, devir, ilerleme ve kesici elmas kodu otomatik gelir; reçeteye özel değiştirebilirsiniz.</div><Field field="recipe-product-qty" title="Takım miktarı" type="number" min="0.01" step="0.01" value={productQty} onChange={setProductQty}/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label htmlFor="param-inner-cooling" className={label}>İçten soğutma</label><select id="param-inner-cooling" value={params.inner_cooling} onChange={(e) => setParam("inner_cooling", e.target.value)} className={input}><option value="">Belirtilmedi</option><option value="VAR">VAR</option><option value="YOK">YOK</option></select></div>{technicalFields.map(([key, title, placeholder]) => <Field key={key} field={`param-${key}`} title={title} placeholder={placeholder} value={params[key]} onChange={(v) => setParam(key, v)}/>)}</div>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3"><div className="text-amber-200 font-black">2. Takım tutucu (isteğe bağlı)</div><SearchSelect field="recipe-holder" labelText="Tutucu ara ve seç (bilmiyorsanız boş bırakın)" value={holderRef} onChange={handleHolderSelect} search={holderSearch} setSearch={setHolderSearch} items={holders} placeholder="Kod, tutucu adı veya marka yazın"/><Field field="recipe-holder-qty" title="Tutucu miktarı" type="number" min="0.01" step="0.01" value={holderQty} onChange={setHolderQty}/><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field field="param-holder-type" title="Tutucu tipi" value={params.holder_type} onChange={(v) => setParam("holder_type", v)} placeholder="VELDON / HİDROLİK"/><Field field="param-holder-length" title="Tutucu boyu" value={params.holder_length} onChange={(v) => setParam("holder_length", v)} placeholder="mm / STANDART"/></div><p className="text-xs text-slate-400">Tutucu stok kaydını bilmiyorsanız yalnızca tipini ve boyunu yazabilirsiniz. Bu durumda tutucu stoktan düşülmez. Yeni teknik alanlar isteğe bağlıdır.</p></div>
      </div>
      <div className="flex gap-2 flex-wrap"><button type="button" onClick={addPair} className="h-11 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 font-bold flex items-center gap-2"><Plus className="w-5 h-5"/>{lineEditId ? "Takım Satırını Güncelle" : "Takımı Reçeteye Ekle"}</button>{(productRef || lineEditId) && <button type="button" onClick={clearLineForm} className="h-11 px-4 rounded-lg bg-slate-700">Satır Seçimini İptal Et</button>}</div>
      {lines.length > 0 && <div className="border border-violet-500/40 rounded-xl overflow-hidden"><div className="px-4 py-3 bg-violet-950/30 text-violet-200 font-bold">Reçete kalemleri ({lines.length}) — düzenlemek için satırdaki Düzenle düğmesine basın</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-400"><th className="p-3">Takım no</th><th className="p-3">Takım / marka</th><th className="p-3">Teknik bilgiler</th><th className="p-3">Tutucu</th><th className="p-3">İşlem</th></tr></thead><tbody>{lines.map((l, i) => <tr key={l.pairId} className="border-t border-slate-800"><td className="p-3">{l.product?.tool_no || i + 1}</td><td className="p-3 font-semibold">{l.product?.code ? `${l.product.code} — ` : ""}{l.product?.name || "Tutucu satırı"}<div className="text-xs text-slate-500">{l.product?.brand || "Marka yok"} · {l.product?.quantity || "-"}</div></td><td className="p-3 text-xs text-slate-300">Boy: {l.product?.machining_length || "-"} · Vc: {l.product?.cutting_speed || "-"} · N: {l.product?.spindle_speed || "-"} · F: {l.product?.feed_rate || "-"}<div>Soğutma: {l.product?.inner_cooling || "-"} · Helis: {l.product?.drill_helix_length || "-"} · Ömür: {l.product?.tool_life || "-"}</div><div>İnsert: {l.product?.insert_brand || "-"} / {l.product?.used_insert || "-"} / {l.product?.insert_quality || "-"}</div><div>Özel: {l.product?.special || "-"}</div></td><td className="p-3 text-xs">{l.holder?.name || "Stok bağlantısı yok"}<div>Tip: {l.product?.holder_type || "-"} · Boy: {l.product?.holder_length || "-"}</div>{l.holder && <div>{l.holder.brand} · {l.holder.quantity}</div>}</td><td className="p-3"><div className="flex gap-2">{l.product && <button type="button" onClick={() => editLine(l)} className="text-violet-300 hover:text-violet-100 flex gap-1" title="Takım satırını düzenle"><Pencil className="w-4 h-4"/>Düzenle</button>}<button type="button" onClick={() => { setLines((prev) => prev.filter((x) => x.pairId !== l.pairId)); if (lineEditId === l.pairId) clearLineForm(); }} className="text-slate-500 hover:text-red-300" title="Kalemi sil"><Trash2 className="w-4 h-4"/></button></div></td></tr>)}</tbody></table></div></div>}
      <div className="flex gap-2"><button disabled={saving} className="h-12 px-6 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>} {editId ? "Değişiklikleri Kaydet" : "Reçeteyi Kaydet"}</button>{editId && <button type="button" onClick={resetRecipeForm} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold">Düzenlemeyi İptal Et</button>}</div>
    </form>
    <div className="bg-slate-800/60 border border-amber-500/30 rounded-2xl p-6 space-y-4"><div className="font-bold text-amber-300">Reçeteyi tezgâha bağla ve stoktan düş</div><p className="text-sm text-slate-400">Taslak kaydetmek stoktan düşmez. Tezgâh seçip bağladığınızda reçetedeki ürün ve tutucu kalemleri stoktan düşürülür.</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label htmlFor="recipe-bind" className={label}>Taslak reçete</label><select id="recipe-bind" value={bindFor} onChange={(e) => setBindFor(e.target.value)} className={input}><option value="">Seçin</option>{recipes.filter((r) => r.status !== "bound").map((r) => <option key={r.id} value={r.id}>{r.name} — {r.workpiece_name}</option>)}</select></div><div><label htmlFor="recipe-bind-machine" className={label}>Bağlanacak tezgâh</label><select id="recipe-bind-machine" value={machine} onChange={(e) => setMachine(e.target.value)} className={input}><option value="">Seçin</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}</select></div><div className="flex items-end"><button type="button" onClick={bind} disabled={saving} className="h-11 px-5 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/>Bağlandı ve Stoktan Düş</button></div></div></div>
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-700 font-bold">Reçete kayıtları</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-400"><th className="p-4">Reçete</th><th className="p-4">Parça</th><th className="p-4">Kalem</th><th className="p-4">Durum</th><th className="p-4">Tezgâh</th><th className="p-4">İşlem</th></tr></thead><tbody>{recipes.map((r) => <tr key={r.id} className="border-t border-slate-800"><td className="p-4 font-semibold">{r.name}<div className="text-xs text-slate-500">{r.document_no ?? CARD_DEFAULTS.document_no} · Op. {r.operation_no ?? "20"}</div></td><td className="p-4">{r.workpiece_name}</td><td className="p-4">{r.lines?.filter((l) => l.kind === "product").length || 0} takım + {r.lines?.filter((l) => l.kind === "toolholder").length || 0} tutucu</td><td className="p-4"><span className={r.status === "bound" ? "text-emerald-300" : "text-amber-300"}>{r.status === "bound" ? "Tezgâha bağlı" : "Taslak — stok düşmedi"}</span></td><td className="p-4">{r.machine_name || r.machine_code || "-"}</td><td className="p-4"><div className="flex gap-2"><button type="button" onClick={() => exportExcel(r.id)} disabled={exporting} className="h-9 px-3 rounded-lg bg-emerald-700 font-semibold">Excel</button><button type="button" onClick={() => editRecipe(r)} disabled={r.status === "bound"} className="h-9 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 font-semibold">Düzenle</button><button type="button" onClick={() => deleteRecipe(r)} disabled={r.status === "bound"} className="h-9 px-3 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-40 font-semibold">Sil</button></div></td></tr>)}</tbody></table>{recipes.length === 0 && <div className="p-6 text-slate-400 text-center">Henüz reçete kaydı yok.</div>}</div></div>
  </div>;
}
