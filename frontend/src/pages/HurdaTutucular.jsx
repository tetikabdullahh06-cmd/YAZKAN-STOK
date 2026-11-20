import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, ImagePlus, Loader2, PackageX, Pencil, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import { ImageHover, ImageLightbox } from "@/components/ImageUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { dateOnly } from "@/lib/dateFormat";

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = "w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100 outline-none focus:ring-2 focus:ring-red-500";
const areaClass = "w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 outline-none focus:ring-2 focus:ring-red-500";
const labelClass = "block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider";
const reasons = ["Kırıldı", "Ezildi / deforme oldu", "Aşındı", "Ölçü toleransı dışına çıktı", "Yanlış kullanım kaynaklı hasar", "Korozyon / paslanma", "Kayboldu / bulunamıyor", "Diğer"];
const PRODUCT_CATEGORIES = ["Kesici Uç", "Matkap", "Kater", "Apparat", "Ölçüm Aleti", "Diğer"];
const personName = (p) => `${p.first_name || ""} ${p.last_name || ""}`.trim();

const emptyForm = {
  holder_id: "",
  quantity: "",
  scrap_reason: "",
  description: "",
  scrap_date: today(),
  location: "",
  machine_id: "",
  production_product: "",
  // Kırılan Takım Kartı (T4.000) alanları
  tool_manufacturer: "",
  tool_name_code: "",
  part_no: "",
  break_reasons: ["", "", ""],
  document_no: "T4.000",
  document_revision: "00",
  change_reason: "",
  prepared_by: "Abdullah Tetik",
  foreman_name: "Celal",
  approved_by: "",
  root_cause: "",
  corrective_action: "",
  preventive_action: "",
  disposition: "",
  operator_personnel_id: "",
  approver_personnel_id: "",
  witness_personnel_id: "",
  before_image_url: "",
  after_image_url: "",
  before_image_urls: [],
  after_image_urls: [],
};

function MultiPhotoUpload({ value = [], onChange, label, hint }) {
  const [uploading, setUploading] = useState(false);
  const files = Array.isArray(value) ? value : (value ? [value] : []);
  const onFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (!selectedFiles.length) return toast.error("Lütfen görsel dosyası seçin");
    const tooLarge = selectedFiles.find((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) return toast.error("Her görsel en fazla 5 MB olabilir");
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of selectedFiles) {
        const data = new FormData();
        data.append("file", file);
        const response = await api.post("/images/upload", data);
        uploaded.push(response.data.image_url);
      }
      onChange([...files, ...uploaded]);
      toast.success(`${uploaded.length} görsel yüklendi`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Görseller yüklenemedi");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };
  return (
    <div>
      <label className="block text-sm font-black text-slate-800 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-slate-900 hover:bg-slate-700 text-white font-black cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {uploading ? "Yükleniyor..." : "Fotoğraf ekle"}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onFiles} className="hidden" />
        </label>
        {files.map((src, index) => (
          <div key={`${src}-${index}`} className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-slate-300 bg-slate-100">
            <ImageLightbox src={src} alt={`${label} ${index + 1}`}>
              <img src={src} alt={`${label} ${index + 1}`} className="w-full h-full object-cover" />
            </ImageLightbox>
            <button type="button" onClick={() => onChange(files.filter((_, i) => i !== index))} className="absolute top-0 right-0 hidden group-hover:flex bg-red-700 text-white rounded-bl p-1" aria-label="Görseli kaldır">
              <X className="w-3 h-3" />
            </button>
            <span className="absolute bottom-0 left-0 bg-slate-900/80 text-white text-[10px] px-1">{index + 1}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">Birden fazla fotoğraf seçebilirsiniz. Fotoğraf başına en fazla 5 MB. Excel kartına ilk fotoğraf yerleştirilir.</p>
    </div>
  );
}

export default function HurdaTutucular() {
  const [holders, setHolders] = useState([]);
  const [products, setProducts] = useState([]);
  const [scraps, setScraps] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stok");

  const load = async () => {
    setLoading(true);
    try {
      const [h, pdt, s, p, m] = await Promise.all([
        api.get("/toolholders"), api.get("/products"), api.get("/toolholder-scraps"), api.get("/personnel"), api.get("/machines"),
      ]);
      setHolders(h.data || []);
      setProducts(pdt.data || []);
      setScraps(s.data || []);
      setPersonnel(p.data || []);
      setMachines(m.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Hurda kayıtları yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(
    () => Array.from(new Set([...PRODUCT_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)])).sort((a, b) => a.localeCompare(b, "tr")),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    const holderRows = holders.map((h) => ({ ...h, _stockType: "holder" }));
    const productRows = products.map((p) => ({ ...p, _stockType: "product", type: p.category || "Ürün", cutting_tool_code_name: p.code || "" }));
    return [...holderRows, ...productRows].filter((h) => {
      if (categoryFilter && (h._stockType !== "product" || h.category !== categoryFilter)) return false;
      return !q || `${h.name} ${h.brand || ""} ${h.type || ""} ${h.cutting_tool_code_name || ""} ${h.code || ""}`.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [holders, products, search, categoryFilter]);

  const selectedKey = String(form.holder_id || "");
  const selectedType = selectedKey.startsWith("product:") ? "product" : "holder";
  const selectedId = selectedKey.includes(":") ? selectedKey.split(":").slice(1).join(":") : selectedKey;
  const selected = selectedType === "product" ? products.find((p) => p.id === selectedId) : holders.find((h) => h.id === selectedId);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Stok kartı seçildiğinde formdaki takım bilgileri otomatik doldurulur.
  useEffect(() => {
    if (!selected || editingId) return;
    setForm((f) => ({
      ...f,
      tool_manufacturer: f.tool_manufacturer || selected.brand || "",
      tool_name_code: f.tool_name_code || [selected.name, selected.code].filter(Boolean).join(" "),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, editingId]);

  const editingRecipeScrap = Boolean(editingId && scraps.find((s) => s.id === editingId)?.source === "recipe_return");
  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const edit = (s) => {
    setEditingId(s.id);
    const storedReasons = Array.isArray(s.break_reasons) && s.break_reasons.length
      ? s.break_reasons
      : [s.scrap_reason, s.description].filter(Boolean);
    const paddedReasons = [...storedReasons];
    while (paddedReasons.length < 3) paddedReasons.push("");
    setForm({
      holder_id: `${s.stock_type === "product" ? "product" : "holder"}:${s.stock_type === "product" ? s.product_id : s.tool_holder_id || ""}`,
      quantity: String(s.quantity || ""),
      scrap_reason: s.scrap_reason || "",
      description: s.description || "",
      scrap_date: s.scrap_date || today(),
      location: s.location || "",
      operator_personnel_id: s.operator_personnel_id || "",
      approver_personnel_id: s.approver_personnel_id || "",
      witness_personnel_id: s.witness_personnel_id || "",
      machine_id: s.machine_id || "",
      production_product: s.production_product || "",
      tool_manufacturer: s.tool_manufacturer || s.brand || "",
      tool_name_code: s.tool_name_code || s.name || "",
      part_no: s.part_no || "",
      break_reasons: paddedReasons,
      document_no: s.document_no || "T4.000",
      document_revision: s.document_revision || "00",
      change_reason: s.change_reason || "",
      prepared_by: s.prepared_by || "Abdullah Tetik",
      foreman_name: s.foreman_name || "Celal",
      approved_by: s.approved_by || "",
      root_cause: s.root_cause || "",
      corrective_action: s.corrective_action || "",
      preventive_action: s.preventive_action || "",
      disposition: s.disposition || "",
      before_image_url: s.before_image_url || "",
      after_image_url: s.after_image_url || "",
      before_image_urls: s.before_image_urls || (s.before_image_url ? [s.before_image_url] : []),
      after_image_urls: s.after_image_urls || (s.after_image_url ? [s.after_image_url] : []),
    });
    setActiveTab("stok");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.holder_id || !form.scrap_reason || !Number(form.quantity) || Number(form.quantity) <= 0 || !selected) {
      return toast.error("Stok ürünü/tutucu, miktar ve hurda nedeni zorunludur");
    }
    const current = Number(selected?.current_stock || 0);
    const oldQty = editingId ? Number(scraps.find((s) => s.id === editingId)?.quantity || 0) : 0;
    if (!editingId && Number(form.quantity) > current) return toast.error("Hurda miktarı mevcut stoktan fazla olamaz");
    if (editingId && current + oldQty < Number(form.quantity)) return toast.error("Bu düzeltme stok miktarını eksiye düşürüyor");
    const question = editingId
      ? (editingRecipeScrap ? "İade hurda kaydının açıklamaları güncellenecek; stok değişmeyecek. Devam edilsin mi?" : "Hurda kaydı düzeltilecek ve stok farkı uygulanacak. Devam edilsin mi?")
      : `${selected.name} ürününden ${form.quantity} adet hurdaya ayrılacak. Devam edilsin mi?`;
    if (!window.confirm(question)) return;
    setSaving(true);
    try {
      const body = {
        stock_type: selectedType,
        product_id: selectedType === "product" ? selected.id : "",
        quantity: Number(form.quantity),
        scrap_reason: form.scrap_reason,
        description: form.description,
        scrap_date: form.scrap_date,
        location: form.location,
        machine_id: form.machine_id,
        production_product: form.production_product,
        tool_manufacturer: form.tool_manufacturer,
        tool_name_code: form.tool_name_code,
        part_no: form.part_no,
        break_reasons: form.break_reasons.map((item) => item.trim()).filter(Boolean),
        document_no: form.document_no,
        document_revision: form.document_revision,
        change_reason: form.change_reason,
        prepared_by: form.prepared_by,
        foreman_name: form.foreman_name,
        approved_by: form.approved_by,
        root_cause: form.root_cause,
        corrective_action: form.corrective_action,
        preventive_action: form.preventive_action,
        disposition: form.disposition,
        operator_personnel_id: form.operator_personnel_id,
        approver_personnel_id: form.approver_personnel_id,
        witness_personnel_id: form.witness_personnel_id,
        before_image_url: form.before_image_urls[0] || "",
        after_image_url: form.after_image_urls[0] || "",
        before_image_urls: form.before_image_urls,
        after_image_urls: form.after_image_urls,
      };
      const r = editingId
        ? await api.put(`/toolholder-scraps/${editingId}`, body)
        : await api.post(`/${selectedType === "product" ? "products" : "toolholders"}/${selected.id}/scrap`, body);
      toast.success(editingId ? `Hurda kaydı düzeltildi. Yeni stok: ${r.data.new_stock}` : `Hurda kaydı oluşturuldu. Yeni stok: ${r.data.new_stock}`);
      reset();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Hurda işlemi yapılamadı");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (s.source === "recipe_return") return toast.info("Tezgâh iadesine bağlı hurda kaydı silinemez; stok geçmişi korunur");
    if (!window.confirm(`${s.name} hurda kaydı silinsin mi? ${s.quantity} adet stok geri eklenecek.`)) return;
    try {
      const r = await api.delete(`/toolholder-scraps/${s.id}`);
      toast.success(`Kayıt silindi. Yeni stok: ${r.data.new_stock}`);
      if (editingId === s.id) reset();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Hurda kaydı silinemedi");
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (s) => {
    try {
      const r = await api.get(`/toolholder-scraps/${s.id}/pdf`, { responseType: "blob" });
      downloadBlob(r.data, `hurda-tutanagi-${s.id.slice(0, 8)}.pdf`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "PDF tutanak indirilemedi");
    }
  };

  const downloadExcel = async (s) => {
    try {
      const r = await api.get(`/toolholder-scraps/${s.id}/excel`, { responseType: "blob" });
      downloadBlob(r.data, `kirilan-takim-karti-${s.record_no || s.id.slice(0, 8)}.xlsx`);
      toast.success("Kırılan Takım Kartı indirildi");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Excel kartı indirilemedi");
    }
  };

  const setBreakReason = (index, value) => setForm((f) => ({ ...f, break_reasons: f.break_reasons.map((item, i) => (i === index ? value : item)) }));
  const addBreakReason = () => setForm((f) => ({ ...f, break_reasons: [...f.break_reasons, ""] }));
  const removeBreakReason = (index) => setForm((f) => ({ ...f, break_reasons: f.break_reasons.filter((_, i) => i !== index) }));

  const personSelect = (label, key) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select value={form[key]} onChange={(e) => set(key, e.target.value)} className={inputClass}>
        <option value="">-- Personel seçin --</option>
        {personnel.map((p) => (
          <option key={p.id} value={p.id}>{personName(p)}{p.department ? ` — ${p.department}` : ""}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-red-500 uppercase tracking-[0.2em] font-bold mb-2">Stoktan Kullanım Dışı Ayırma</div>
          <h1 className="font-display text-4xl font-black">Takım Tutucu Hurda / Kullanım Dışı</h1>
          <p className="text-slate-700 mt-2 font-semibold">Kırılan, ezilen veya kullanılamaz duruma gelen tutucuları gerekçesiyle kaydedin, stoktan düşürün ve Kırılan Takım Kartı (T4.000) çıktısını alın.</p>
        </div>
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800 font-bold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Hurda işlemi stoktan düşer
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-slate-600 font-bold text-sm">Stok / tutucu çeşidi</div>
          <div className="text-3xl font-black mt-2 text-slate-950">{holders.length + products.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-slate-600 font-bold text-sm">Hurda kaydı</div>
          <div className="text-3xl font-black mt-2 text-red-700">{scraps.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-slate-600 font-bold text-sm">Toplam hurda miktarı</div>
          <div className="text-3xl font-black mt-2 text-amber-700">{scraps.reduce((n, s) => n + Number(s.quantity || 0), 0)} adet</div>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-red-700 font-black text-lg">
            <PackageX className="w-6 h-6" />
            {editingId ? "Hurda tutanağını düzelt" : "Kırılan Takım Kartı oluştur"}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Doküman No: {form.document_no || "T4.000"} · Rev: {form.document_revision || "00"}</span>
            {editingId && (
              <button type="button" onClick={reset} className="text-sm text-slate-700 flex items-center gap-1">
                <X className="w-4 h-4" /> İptal
              </button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="stok">1 · Stok Kaydı</TabsTrigger>
            <TabsTrigger value="takim">2 · Takım &amp; Parça</TabsTrigger>
            <TabsTrigger value="kirilma">3 · Kırılma Sebebi</TabsTrigger>
            <TabsTrigger value="gorsel">4 · Görseller</TabsTrigger>
            <TabsTrigger value="onay">5 · Onay &amp; Doküman</TabsTrigger>
          </TabsList>

          <TabsContent value="stok" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Kategori filtresi</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
                  <option value="">-- Tüm kategoriler ve tutucular --</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Takım, tutucu veya stok ürünü ara</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={categoryFilter ? `${categoryFilter} kategorisinde ara...` : "Ad, kod, marka, kategori veya kesici uç ara..."} className={`${inputClass} pl-10`} />
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Hurdaya ayrılacak takım veya tutucu seçin</label>
              <select required disabled={!!editingId} value={form.holder_id} onChange={(e) => set("holder_id", e.target.value)} className={inputClass}>
                <option value="">-- Tüm stoktan ürün/tutucu seçin --</option>
                {filtered.map((h) => (
                  <option key={`${h._stockType}:${h.id}`} value={`${h._stockType}:${h.id}`}>
                    {h._stockType === "product" ? "ÜRÜN" : "TUTUCU"} — {h.name} | {h.brand || "-"} | Stok: {h.current_stock} {h.unit || "adet"}
                  </option>
                ))}
              </select>
            </div>

            {editingRecipeScrap && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 text-sm font-semibold">
                Bu hurda kaydı tezgâhtan alınan iadeye bağlıdır. Miktar ve stok hareketi değiştirilmez; açıklamaları, fotoğrafları ve tutanak bilgilerini güncelleyebilirsiniz.
              </p>
            )}

            {selected && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><span className="text-slate-500 block font-bold">Kayıt türü</span><b>{selectedType === "product" ? "Stok ürünü" : "Takım tutucu"}</b></div>
                <div><span className="text-slate-500 block font-bold">Ad / Kod</span><b>{selected.name}{selected.code ? ` / ${selected.code}` : ""}</b></div>
                <div><span className="text-slate-500 block font-bold">Marka / Kategori</span>{selected.brand || selected.category || "-"}</div>
                <div><span className="text-slate-500 block font-bold">Tip / Ölçü</span>{selected.type || `Boy ${selected.length || "-"} / Çap ${selected.diameter || "-"}`}</div>
                <div><span className="text-slate-500 block font-bold">Mevcut stok</span><b className="text-emerald-700">{selected.current_stock} {selected.unit || "adet"}</b></div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Hurda miktarı</label>
                <input required disabled={editingRecipeScrap} type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Hurda nedeni</label>
                <select required value={form.scrap_reason} onChange={(e) => set("scrap_reason", e.target.value)} className={inputClass}>
                  <option value="">-- Neden seçin --</option>
                  {reasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Hurda tarihi</label>
                <input required type="date" value={form.scrap_date} onChange={(e) => set("scrap_date", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Konum / hurda alanı</label>
                <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Hurda alanı" className={inputClass} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="takim" className="space-y-4 pt-4">
            <p className="text-sm text-slate-600 font-semibold">Bu alanlar kartın üst bölümüne birebir yazılır: Takım üretici firma adı, takım adı/kodu, parça adı, parça no, operatör ve tezgah no-tarih.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Takım üretici firma adı</label>
                <input value={form.tool_manufacturer} onChange={(e) => set("tool_manufacturer", e.target.value)} placeholder="Örn. TEKNİK" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Takım adı / kodu</label>
                <input value={form.tool_name_code} onChange={(e) => set("tool_name_code", e.target.value)} placeholder="Örn. THB09-80-130(M3,5-CCMT09)" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Parça adı</label>
                <input value={form.production_product} onChange={(e) => set("production_product", e.target.value)} placeholder="Örn. ABB-5284863-25" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Parça no</label>
                <input value={form.part_no} onChange={(e) => set("part_no", e.target.value)} placeholder="Örn. 3420" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tezgah</label>
                <select value={form.machine_id} onChange={(e) => set("machine_id", e.target.value)} className={inputClass}>
                  <option value="">-- Tezgâh seçin --</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}{m.brand ? ` (${m.brand})` : ""}</option>)}
                </select>
              </div>
              {personSelect("Operatör adı-soyadı", "operator_personnel_id")}
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
              <b>Karta yazılacak tezgah no-tarih:</b>{" "}
              {machines.find((m) => m.id === form.machine_id)?.code || "-"} / {form.scrap_date || "-"}
            </div>
          </TabsContent>

          <TabsContent value="kirilma" className="space-y-4 pt-4">
            <div>
              <label className={labelClass}>Kırılma sebebi - uyarılar - önlemler</label>
              <p className="text-xs text-slate-500 mb-2">Her satır kartta 1., 2., 3. … olarak numaralanır. Şablonda 11 satıra kadar yer var.</p>
              <div className="space-y-2">
                {form.break_reasons.map((value, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="w-7 pt-3 text-right font-black text-slate-500">{index + 1}.</span>
                    <input
                      value={value}
                      onChange={(e) => setBreakReason(index, e.target.value)}
                      placeholder={index === 0 ? "Örn. K.S=TEZGAH RESETLENDİKTEN SONRA REFERANS KONUMUNA GÖNDERİLMEDEN M62 KODU KULLANILARAK PARÇA ÜZERİNDE ÇARPMA OLUŞTU" : "Uyarı / önlem satırı"}
                      className={inputClass}
                    />
                    <button type="button" onClick={() => removeBreakReason(index)} disabled={form.break_reasons.length <= 1} className="h-11 w-11 shrink-0 rounded-lg bg-slate-200 hover:bg-red-200 text-slate-700 disabled:opacity-40 flex items-center justify-center" aria-label="Satırı kaldır">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addBreakReason} disabled={form.break_reasons.length >= 11} className="mt-2 inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-slate-900 hover:bg-slate-700 text-white font-black disabled:opacity-40">
                <Plus className="w-4 h-4" /> Satır ekle
              </button>
            </div>
            <div>
              <label className={labelClass}>Neden ve hasar açıklaması</label>
              <textarea required value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Hasarın nasıl oluştuğunu, ezilme/kırılma durumunu ve tespit notlarını yazın..." className={areaClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Kök neden</label>
                <textarea value={form.root_cause} onChange={(e) => set("root_cause", e.target.value)} rows={2} placeholder="Kırılmanın temel nedeni" className={areaClass} />
              </div>
              <div>
                <label className={labelClass}>Uygunsuzluk kararı</label>
                <select value={form.disposition} onChange={(e) => set("disposition", e.target.value)} className={inputClass}>
                  <option value="">-- Karar seçin --</option>
                  <option value="Hurdaya ayrıldı">Hurdaya ayrıldı</option>
                  <option value="Kullanım dışı bırakıldı">Kullanım dışı bırakıldı</option>
                  <option value="İncelemeye alındı">İncelemeye alındı</option>
                  <option value="Şartlı kullanıma verildi">Şartlı kullanıma verildi</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Düzeltici faaliyet</label>
                <textarea value={form.corrective_action} onChange={(e) => set("corrective_action", e.target.value)} rows={2} placeholder="Yapılan düzeltme" className={areaClass} />
              </div>
              <div>
                <label className={labelClass}>Önleyici faaliyet</label>
                <textarea value={form.preventive_action} onChange={(e) => set("preventive_action", e.target.value)} rows={2} placeholder="Tekrarını önlemek için alınacak önlem" className={areaClass} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gorsel" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MultiPhotoUpload
                value={form.before_image_urls}
                onChange={(before_image_urls) => setForm({ ...form, before_image_urls, before_image_url: before_image_urls[0] || "" })}
                label="RESİM-1 · İlk hali / stoktaki görsel"
                hint="Kartın sol fotoğraf kutusuna yerleşir."
              />
              <MultiPhotoUpload
                value={form.after_image_urls}
                onChange={(after_image_urls) => setForm({ ...form, after_image_urls, after_image_url: after_image_urls[0] || "" })}
                label="RESİM-2 · Kırık / ezik hali"
                hint="Kartın sağ fotoğraf kutusuna yerleşir."
              />
            </div>
          </TabsContent>

          <TabsContent value="onay" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Hazırlayan</label>
                <input value={form.prepared_by} onChange={(e) => set("prepared_by", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Formen</label>
                <input value={form.foreman_name} onChange={(e) => set("foreman_name", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Onaylayan</label>
                <input value={form.approved_by} onChange={(e) => set("approved_by", e.target.value)} placeholder="Boş bırakılabilir" className={inputClass} />
              </div>
              {personSelect("Tanık / teslim alan", "witness_personnel_id")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Doküman No</label>
                <input value={form.document_no} onChange={(e) => set("document_no", e.target.value)} placeholder="T4.000" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Doküman Rev. No</label>
                <input value={form.document_revision} onChange={(e) => set("document_revision", e.target.value)} placeholder="00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Değ. Nedeni</label>
                <input value={form.change_reason} onChange={(e) => set("change_reason", e.target.value)} placeholder="Değişiklik nedeni" className={inputClass} />
              </div>
            </div>
            <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
              Kart başlığı: <b>Kırılan Takım Kartı</b> · Doküman No: <b>{form.document_no || "T4.000"}</b> · Doküman Rev. No: <b>{form.document_revision || "00"}</b> · Değ. Nedeni: <b>{form.change_reason || "-"}</b>
            </p>
          </TabsContent>
        </Tabs>

        <button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black flex items-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
          {editingId ? "Düzeltmeyi Kaydet" : "Hurdaya Ayır ve Kartı Kaydet"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-5 h-5 text-red-700" />
          <h2 className="font-black text-lg text-slate-950">Hurda kayıtları ve tutanaklar</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : scraps.length === 0 ? (
          <div className="p-8 text-center text-slate-600 font-semibold">Henüz hurda kaydı yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-700 border-b border-slate-200">
                  <th className="p-4">Tarih</th>
                  <th className="p-4">Takım / Ürün</th>
                  <th className="p-4">Miktar</th>
                  <th className="p-4">Hurda nedeni</th>
                  <th className="p-4">Personel</th>
                  <th className="p-4">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {scraps.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{dateOnly(s.scrap_date)}</td>
                    <td className="p-4">
                      <b>{s.name}</b>
                      {s.source === "recipe_return" && <div className="text-xs font-semibold text-blue-700">Tezgâh iadesi — stok tekrar düşülmedi</div>}
                      <ImageHover src={(s.after_image_urls || [])[0] || s.after_image_url || (s.before_image_urls || [])[0] || s.before_image_url} alt={s.name} />
                      <div className="text-slate-600">{s.brand || "-"} · {s.stock_type === "product" ? `${s.code || ""} · ${s.holder_type || "Ürün"}` : (s.holder_type || "Tutucu")}</div>
                    </td>
                    <td className="p-4 font-black text-red-700">{s.quantity} adet</td>
                    <td className="p-4 font-bold text-slate-900">
                      {s.scrap_reason}
                      <div className="text-slate-600 font-normal max-w-xs">{s.description || "-"}</div>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div>İşlemi yapan: {s.operator_name || s.user_name || "-"}</div>
                      <div>Onay: {s.approved_by || "-"}</div>
                      <div>Tanık: {s.witness || "-"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => edit(s)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-black">
                          <Pencil className="w-4 h-4" /> Düzelt
                        </button>
                        <button type="button" onClick={() => remove(s)} disabled={s.source === "recipe_return"} title={s.source === "recipe_return" ? "Tezgâh iade geçmişine bağlı kayıt silinemez" : "Hurda kaydını sil ve stoğa geri ekle"} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-black disabled:opacity-40 disabled:cursor-not-allowed">
                          <Trash2 className="w-4 h-4" /> Sil
                        </button>
                        <button type="button" onClick={() => downloadExcel(s)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black">
                          <FileSpreadsheet className="w-4 h-4" /> Excel Kartı
                        </button>
                        <button type="button" onClick={() => downloadPdf(s)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-black">
                          <Download className="w-4 h-4" /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
