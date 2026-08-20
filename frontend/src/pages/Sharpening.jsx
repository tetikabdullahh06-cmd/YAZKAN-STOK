import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Factory,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Wrench,
  Download,
  FileSpreadsheet,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = "w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider";

function StatusBadge({ status }) {
  const map = {
    sent: ["Bilemeye gitti", "bg-amber-500/15 text-amber-300 border-amber-500/30"],
    partial: ["Kısmi geldi", "bg-blue-500/15 text-blue-300 border-blue-500/30"],
    returned: ["Stoğa döndü", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"],
  };
  const [text, cls] = map[status] || [status, "bg-slate-500/15 text-slate-300 border-slate-500/30"];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{text}</span>;
}

export default function Sharpening() {
  const [products, setProducts] = useState([]);
  const [records, setRecords] = useState([]);
  const [tab, setTab] = useState("out");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [outForm, setOutForm] = useState({ quantity: "", helix_length: "", diameter: "", full_length: "", process_type: "alın bileme", company: "", sent_date: today(), note: "" });
  const [inForm, setInForm] = useState({ record_id: "", quantity: "", company: "", waybill_number: "", received_date: today(), note: "" });
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingSection, setEditingSection] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([api.get("/products"), api.get("/sharpening/records")]);
      setProducts(p.data || []);
      setRecords(r.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Bileme kayıtları yüklenemedi");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.code} ${p.name} ${p.category}`.toLowerCase().includes(q));
  }, [products, search]);
  const openRecords = records.filter((r) => r.status !== "returned" && Number(r.remaining_quantity || 0) > 0);

  const exportExcel = () => {
    const rows = records.map((r) => ({
      "Hareket Tipi": r.status === "returned" ? "gelen" : "giden",
      "Ürün Kodu": r.product_code || "",
      "Ürün Adı": r.product_name || "",
      "Miktar": r.quantity || 0,
      "Helis Boyu": r.helix_length || "",
      "Çap": r.diameter || "",
      "Tam Boy": r.full_length || "",
      "Yapılacak İşlem": r.process_type || "alın bileme",
      "Firma": r.company || "",
      "Gidiş Tarihi": r.sent_date || "",
      "Gelen Miktar": r.returned_quantity || 0,
      "İrsaliye No": r.waybill_number || "",
      "Geliş Tarihi": r.received_date || "",
      "Not": r.note || "",
      "Durum": r.status || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bileme Kayıtları");
    XLSX.writeFile(wb, `bileme-kayitlari-${today()}.xlsx`);
    toast.success(`${rows.length} bileme kaydı Excel'e aktarıldı`);
  };
  const downloadTemplate = () => {
    const rows = [
      { "Hareket Tipi": "giden", "Ürün Kodu": "UÇ-001", "Ürün Adı": "Örnek Uç", "Miktar": 1, "Helis Boyu": "35 mm", "Çap": "Ø12", "Tam Boy": "100 mm", "Yapılacak İşlem": "alın bileme", "Firma": "Örnek Bileme", "Gidiş Tarihi": today(), "Gelen Miktar": "", "İrsaliye No": "", "Geliş Tarihi": "", "Not": "Şablon satırı" },
      { "Hareket Tipi": "gelen", "Ürün Kodu": "UÇ-001", "Ürün Adı": "Örnek Uç", "Miktar": "", "Helis Boyu": "", "Çap": "", "Tam Boy": "", "Yapılacak İşlem": "", "Firma": "Gelen Firma", "Gidiş Tarihi": today(), "Gelen Miktar": 1, "İrsaliye No": "IRS-001", "Geliş Tarihi": today(), "Not": "Gelen satırda Ürün Kodu ve Gidiş Tarihi ile açık kayıt eşleştirilir" },
    ];
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bileme Şablonu");
    XLSX.writeFile(wb, "bileme-giden-gelen-sablonu.xlsx");
    toast.success("Bileme Excel şablonu indirildi");
  };
  const importExcel = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    try {
      const data = await file.arrayBuffer(); const book = XLSX.read(data, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" });
      if (!rows.length) return toast.error("Excel dosyasında kayıt bulunamadı");
      setSaving(true); let count = 0;
      for (const row of rows) {
        const type = String(row["Hareket Tipi"] || row.hareket_tipi || "giden").toLowerCase();
        const code = String(row["Ürün Kodu"] || row.urun_kodu || "").trim();
        const name = String(row["Ürün Adı"] || row.urun_adi || "").trim();
        const sentDate = row["Gidiş Tarihi"] || row.gidis_tarihi || "";
        if (type === "gelen") {
          const matched = records.find((r) => (!code || r.product_code === code) && (!sentDate || String(r.sent_date || "").slice(0, 10) === String(sentDate).slice(0, 10)) && r.status !== "returned");
          const recordId = matched?.id;
          if (!recordId) continue;
          await api.post("/sharpening/in", { record_id: recordId, quantity: row["Gelen Miktar"] === "" ? null : Number(row["Gelen Miktar"] || row.gelen_miktar), company: row.Firma || row.firma || "", waybill_number: row["İrsaliye No"] || row.irsaliye_no || "", received_date: row["Geliş Tarihi"] || row.gelis_tarihi || today(), note: row.Not || row.not || "" });
        } else {
          const matched = products.find((p) => (code && p.code === code) || (!code && name && p.name === name));
          const productId = matched?.id;
          if (!productId) continue;
          await api.post("/sharpening/out", { product_id: productId, quantity: Number(row.Miktar || row.miktar) || 0, helix_length: row["Helis Boyu"] || row.helis_boyu || "", diameter: row.Çap || row.cap || "", full_length: row["Tam Boy"] || row.tam_boy || "", process_type: row["Yapılacak İşlem"] || row.yapilacak_islem || "alın bileme", company: row.Firma || row.firma || "", sent_date: sentDate || today(), note: row.Not || row.not || "" });
        }
        count += 1;
      }
      toast.success(`${count} bileme hareketi içe aktarıldı`); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Bileme Excel'i içe aktarılamadı"); } finally { setSaving(false); }
  };

  const setOut = (key, value) => setOutForm((f) => ({ ...f, [key]: value }));
  const setIn = (key, value) => setInForm((f) => ({ ...f, [key]: value }));
  const clearEdit = () => { setEditingRecord(null); setEditingSection(""); setSelectedProductId(""); setOutForm({ quantity: "", helix_length: "", diameter: "", full_length: "", process_type: "alın bileme", company: "", sent_date: today(), note: "" }); setInForm({ record_id: "", quantity: "", company: "", waybill_number: "", received_date: today(), note: "" }); };
  const startEdit = (record, section) => { setEditingRecord(record); setEditingSection(section); setTab(section); setSelectedProductId(record.product_id || ""); setOutForm({ quantity: String(record.quantity ?? ""), helix_length: record.helix_length || "", diameter: record.diameter || "", full_length: record.full_length || "", process_type: record.process_type || "alın bileme", company: record.company || "", sent_date: record.sent_date || today(), note: record.note || "" }); setInForm({ record_id: record.id, quantity: String(record.returned_quantity ?? ""), company: record.return_company || "", waybill_number: record.waybill_number || "", received_date: record.received_date || today(), note: record.return_note || "" }); };
  const deleteRecord = async (record) => { if (!window.confirm(`${record.product_code || record.product_name} bileme kaydı silinsin mi? Silme işlemi gönderilen ve henüz dönmeyen miktarı stoğa geri ekler.`)) return; setSaving(true); try { const r = await api.delete(`/sharpening/records/${record.id}`); toast.success(`Bileme kaydı silindi. Stok geri eklendi: ${r.data.new_stock}`); if (editingRecord?.id === record.id) clearEdit(); await load(); } catch (e) { toast.error(e.response?.data?.detail || "Bileme kaydı silinemedi"); } finally { setSaving(false); } };

  const submitOut = async (e) => {
    e.preventDefault();
    if (editingRecord) {
      if (!outForm.company.trim()) return toast.error("Bileme firması yazınız");
      setSaving(true);
      try {
        const r = await api.put(`/sharpening/records/${editingRecord.id}`, { ...outForm, quantity: Number(outForm.quantity), returned_quantity: Number(inForm.quantity) || 0, return_company: inForm.company || "", waybill_number: inForm.waybill_number || "", received_date: inForm.received_date || "", return_note: inForm.note || "" });
        toast.success(`Bilemeye giden kayıt düzeltildi. Yeni stok: ${r.data.new_stock}`); clearEdit(); await load();
      } catch (e) { toast.error(e.response?.data?.detail || "Bileme kaydı düzeltilemedi"); } finally { setSaving(false); }
      return;
    }
    if (!selectedProductId) return toast.error("Ürün seçiniz");
    if (!outForm.company.trim()) return toast.error("Bileme firması yazınız");
    setSaving(true);
    try {
      const r = await api.post("/sharpening/out", { ...outForm, product_id: selectedProductId, quantity: Number(outForm.quantity) });
      toast.success(`Bilemeye gidiş kaydedildi. Yeni stok: ${r.data.new_stock}`);
      setSelectedProductId(""); setSearch("");
      setOutForm({ quantity: "", helix_length: "", diameter: "", full_length: "", process_type: "alın bileme", company: "", sent_date: today(), note: "" });
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Kayıt yapılamadı"); }
    finally { setSaving(false); }
  };

  const submitIn = async (e) => {
    e.preventDefault();
    if (editingRecord) {
      if (!inForm.company.trim() || !inForm.waybill_number.trim()) return toast.error("Firma ve irsaliye numarası zorunludur");
      setSaving(true);
      try {
        const r = await api.put(`/sharpening/records/${editingRecord.id}`, { ...outForm, quantity: Number(outForm.quantity), returned_quantity: Number(inForm.quantity) || 0, return_company: inForm.company, waybill_number: inForm.waybill_number, received_date: inForm.received_date, return_note: inForm.note || "" });
        toast.success(`Bilemeden gelen kayıt düzeltildi. Yeni stok: ${r.data.new_stock}`); clearEdit(); await load();
      } catch (e) { toast.error(e.response?.data?.detail || "Bilemeden gelen kayıt düzeltilemedi"); } finally { setSaving(false); }
      return;
    }
    if (!inForm.record_id) return toast.error("Bileme kaydı seçiniz");
    if (!inForm.company.trim() || !inForm.waybill_number.trim()) return toast.error("Firma ve irsaliye numarası zorunludur");
    setSaving(true);
    try {
      const payload = { ...inForm, quantity: inForm.quantity === "" ? null : Number(inForm.quantity) };
      const r = await api.post("/sharpening/in", payload);
      toast.success(`Bilemeden gelen ürün stoğa eklendi. Yeni stok: ${r.data.new_stock}`);
      setInForm({ record_id: "", quantity: "", company: "", waybill_number: "", received_date: today(), note: "" });
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Stoğa dönüş kaydedilemedi"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Özel Stok Hareketi</div>
          <h1 className="font-display text-4xl font-black">Bilemeye Gidenler / Bilemeden Gelenler</h1>
          <p className="text-slate-400 mt-2">Bilemeye gönderilen ürünleri stoktan düşürün, geri gelenleri irsaliye bilgisiyle tekrar stoğa alın.</p>
        </div>
          <div className="flex gap-2 flex-wrap"><button onClick={downloadTemplate} className="h-11 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center gap-2 text-slate-200"><FileSpreadsheet className="w-4 h-4" /> Örnek Şablon</button><button onClick={exportExcel} className="h-11 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 flex items-center gap-2 text-white"><Download className="w-4 h-4" /> Dışa Aktar</button><label className="h-11 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 flex items-center gap-2 text-white cursor-pointer"><Upload className="w-4 h-4" /> İçe Aktar<input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden" /></label><button onClick={load} className="h-11 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center gap-2 text-slate-300"><RefreshCw className="w-4 h-4" /> Yenile</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5"><div className="text-slate-400 text-sm">Açık bileme kaydı</div><div className="text-3xl font-bold mt-2 text-amber-300">{openRecords.length}</div></div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5"><div className="text-slate-400 text-sm">Bilemeye giden toplam</div><div className="text-3xl font-bold mt-2 text-slate-100">{records.reduce((n, r) => n + Number(r.quantity || 0), 0)}</div></div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5"><div className="text-slate-400 text-sm">Stoğa dönen toplam</div><div className="text-3xl font-bold mt-2 text-emerald-300">{records.reduce((n, r) => n + Number(r.returned_quantity || 0), 0)}</div></div>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        <button onClick={() => setTab("out")} className={`px-5 py-3 font-semibold border-b-2 ${tab === "out" ? "text-blue-300 border-blue-500" : "text-slate-500 border-transparent"}`}><ArrowUpFromLine className="inline w-4 h-4 mr-2" />Bilemeye Giden Ürün</button>
        <button onClick={() => setTab("in")} className={`px-5 py-3 font-semibold border-b-2 ${tab === "in" ? "text-emerald-300 border-emerald-500" : "text-slate-500 border-transparent"}`}><ArrowDownToLine className="inline w-4 h-4 mr-2" />Bilemeden Gelenler</button>
      </div>

      {tab === "out" ? (
        <form onSubmit={submitOut} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 text-blue-300 font-semibold"><Wrench className="w-5 h-5" />Ürün seçin ve bilemeye gönderin</div>
          <div><label className={labelClass}>Ürünlerde ara</label><div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kod, ürün adı veya kategori..." className={`${inputClass} pl-10`} /></div></div>
          <div><label className={labelClass}>Ürün</label><select required value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className={inputClass}><option value="">-- Ürün seçin --</option>{visibleProducts.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name} | Stok: {p.current_stock} {p.unit}</option>)}</select>{selectedProduct && <div className="mt-2 text-xs text-slate-400">Mevcut stok: <b className="text-emerald-300">{selectedProduct.current_stock} {selectedProduct.unit}</b></div>}</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><label className={labelClass}>Miktar</label><input required type="number" min="0.01" step="0.01" value={outForm.quantity} onChange={(e) => setOut("quantity", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Helis boyu</label><input value={outForm.helix_length} onChange={(e) => setOut("helix_length", e.target.value)} placeholder="Örn. 35 mm" className={inputClass} /></div><div><label className={labelClass}>Çapı</label><input value={outForm.diameter} onChange={(e) => setOut("diameter", e.target.value)} placeholder="Örn. Ø12" className={inputClass} /></div><div><label className={labelClass}>Tam boyu</label><input value={outForm.full_length} onChange={(e) => setOut("full_length", e.target.value)} placeholder="Örn. 100 mm" className={inputClass} /></div></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className={labelClass}>Yapılacak işlem</label><select value={outForm.process_type} onChange={(e) => setOut("process_type", e.target.value)} className={inputClass}><option value="alın bileme">Alın bileme</option><option value="tam bileme">Tam bileme</option></select></div><div><label className={labelClass}>Bilemeye gittiği firma</label><div className="relative"><Factory className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" /><input required value={outForm.company} onChange={(e) => setOut("company", e.target.value)} className={`${inputClass} pl-10`} /></div></div><div><label className={labelClass}>Gidiş tarihi</label><input required type="date" value={outForm.sent_date} onChange={(e) => setOut("sent_date", e.target.value)} className={inputClass} /></div></div>
          <div><label className={labelClass}>Not</label><textarea value={outForm.note} onChange={(e) => setOut("note", e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="flex gap-3 flex-wrap"><button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5" />} {editingRecord ? "Bileme Giden Kaydını Güncelle" : "Bilemeye Gitti Olarak Kaydet"}</button>{editingRecord && <button type="button" onClick={clearEdit} className="h-14 px-5 rounded-lg border border-slate-400 bg-white hover:bg-slate-100 font-bold text-slate-900">Düzenlemeyi İptal Et</button>}</div>
        </form>
      ) : (
        <form onSubmit={submitIn} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 text-emerald-300 font-semibold"><PackageCheck className="w-5 h-5" />Bilemeden gelen ürünü tekrar stoğa alın</div>
          <div><label className={labelClass}>Bilemeye giden kayıt</label><select required value={inForm.record_id} onChange={(e) => setIn("record_id", e.target.value)} className={inputClass}><option value="">-- Açık kayıtlardan seçin --</option>{openRecords.map((r) => <option key={r.id} value={r.id}>{r.product_code} — {r.product_name} | Kalan: {r.remaining_quantity} {r.unit} | {r.company} | {r.sent_date}</option>)}</select></div>
          {inForm.record_id && (() => { const r = openRecords.find((x) => x.id === inForm.record_id); return r ? <div className="rounded-xl bg-slate-950/70 border border-slate-700 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div><span className="text-slate-500 block">Ürün</span>{r.product_name}</div><div><span className="text-slate-500 block">Helis boyu</span>{r.helix_length || "-"}</div><div><span className="text-slate-500 block">Çapı</span>{r.diameter || "-"}</div><div><span className="text-slate-500 block">Tam boyu</span>{r.full_length || "-"}</div><div><span className="text-slate-500 block">İşlem</span>{r.process_type}</div></div> : null; })()}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><label className={labelClass}>Gelen miktar</label><input type="number" min="0.01" step="0.01" value={inForm.quantity} onChange={(e) => setIn("quantity", e.target.value)} placeholder="Boş: tamamı" className={inputClass} /></div><div><label className={labelClass}>Firma</label><input required value={inForm.company} onChange={(e) => setIn("company", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>İrsaliye numarası</label><input required value={inForm.waybill_number} onChange={(e) => setIn("waybill_number", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Geliş tarihi</label><input required type="date" value={inForm.received_date} onChange={(e) => setIn("received_date", e.target.value)} className={inputClass} /></div></div>
          <div><label className={labelClass}>Not</label><textarea value={inForm.note} onChange={(e) => setIn("note", e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
          <div className="flex gap-3 flex-wrap"><button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} {editingRecord ? "Bilemeden Gelen Kaydını Güncelle" : "Stoğa Dahil Et"}</button>{editingRecord && <button type="button" onClick={clearEdit} className="h-14 px-5 rounded-lg border border-slate-400 bg-white hover:bg-slate-100 font-bold text-slate-900">Düzenlemeyi İptal Et</button>}</div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex items-center gap-2"><Wrench className="w-5 h-5 text-blue-300" /><h2 className="font-bold text-lg">Bileme kayıtları</h2></div>
        {loading ? <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin inline" /></div> : records.length === 0 ? <div className="p-8 text-center text-slate-500">Henüz bileme kaydı yok.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-700"><th className="p-4">Ürün</th><th className="p-4">İşlemler</th><th className="p-4">Ölçüler</th><th className="p-4">İşlem</th><th className="p-4">Firma / tarih</th><th className="p-4">Miktar</th><th className="p-4">Durum</th><th className="p-4">İrsaliye</th></tr></thead><tbody>{records.map((r) => <tr key={r.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/60"><td className="p-4"><b>{r.product_code}</b><div className="text-slate-400">{r.product_name}</div></td><td className="p-4"><div className="flex items-center gap-2"><button type="button" onClick={() => startEdit(r, r.status === "sent" ? "out" : "in")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold"><Pencil className="w-4 h-4" /> Düzelt</button><button type="button" onClick={() => deleteRecord(r)} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-bold"><Trash2 className="w-4 h-4" /> Sil</button></div></td><td className="p-4 text-slate-300">Helis: {r.helix_length || "-"}<br />Çap: {r.diameter || "-"}<br />Tam: {r.full_length || "-"}</td><td className="p-4">{r.process_type}</td><td className="p-4">{r.company}<div className="text-slate-500">{r.sent_date}</div></td><td className="p-4">{r.returned_quantity || 0} / {r.quantity} {r.unit}<div className="text-xs text-amber-300">Kalan: {r.remaining_quantity}</div></td><td className="p-4"><StatusBadge status={r.status} /></td><td className="p-4">{r.waybill_number || "-"}{r.received_date && <div className="text-slate-500">{r.received_date}</div>}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}

// Keep the component self-contained; all mutations go through the authenticated API client.
// The page intentionally uses the product catalog as the source of selectable stock items.
// eslint-disable-next-line no-unused-vars
const _designNotes = { title: "Bilemeye Gidenler / Bilemeden Gelenler" };
