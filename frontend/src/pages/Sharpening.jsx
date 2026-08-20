import { useEffect, useMemo, useState } from "react";
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

  const setOut = (key, value) => setOutForm((f) => ({ ...f, [key]: value }));
  const setIn = (key, value) => setInForm((f) => ({ ...f, [key]: value }));

  const submitOut = async (e) => {
    e.preventDefault();
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
        <button onClick={load} className="h-11 px-4 rounded-lg border border-slate-700 hover:bg-slate-800 flex items-center gap-2 text-slate-300"><RefreshCw className="w-4 h-4" /> Yenile</button>
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
          <button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5" />} Bilemeye Gitti Olarak Kaydet</button>
        </form>
      ) : (
        <form onSubmit={submitIn} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 text-emerald-300 font-semibold"><PackageCheck className="w-5 h-5" />Bilemeden gelen ürünü tekrar stoğa alın</div>
          <div><label className={labelClass}>Bilemeye giden kayıt</label><select required value={inForm.record_id} onChange={(e) => setIn("record_id", e.target.value)} className={inputClass}><option value="">-- Açık kayıtlardan seçin --</option>{openRecords.map((r) => <option key={r.id} value={r.id}>{r.product_code} — {r.product_name} | Kalan: {r.remaining_quantity} {r.unit} | {r.company} | {r.sent_date}</option>)}</select></div>
          {inForm.record_id && (() => { const r = openRecords.find((x) => x.id === inForm.record_id); return r ? <div className="rounded-xl bg-slate-950/70 border border-slate-700 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div><span className="text-slate-500 block">Ürün</span>{r.product_name}</div><div><span className="text-slate-500 block">Helis boyu</span>{r.helix_length || "-"}</div><div><span className="text-slate-500 block">Çapı</span>{r.diameter || "-"}</div><div><span className="text-slate-500 block">Tam boyu</span>{r.full_length || "-"}</div><div><span className="text-slate-500 block">İşlem</span>{r.process_type}</div></div> : null; })()}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><label className={labelClass}>Gelen miktar</label><input type="number" min="0.01" step="0.01" value={inForm.quantity} onChange={(e) => setIn("quantity", e.target.value)} placeholder="Boş: tamamı" className={inputClass} /></div><div><label className={labelClass}>Firma</label><input required value={inForm.company} onChange={(e) => setIn("company", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>İrsaliye numarası</label><input required value={inForm.waybill_number} onChange={(e) => setIn("waybill_number", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Geliş tarihi</label><input required type="date" value={inForm.received_date} onChange={(e) => setIn("received_date", e.target.value)} className={inputClass} /></div></div>
          <div><label className={labelClass}>Not</label><textarea value={inForm.note} onChange={(e) => setIn("note", e.target.value)} rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
          <button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Stoğa Dahil Et</button>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex items-center gap-2"><Wrench className="w-5 h-5 text-blue-300" /><h2 className="font-bold text-lg">Bileme kayıtları</h2></div>
        {loading ? <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin inline" /></div> : records.length === 0 ? <div className="p-8 text-center text-slate-500">Henüz bileme kaydı yok.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b border-slate-700"><th className="p-4">Ürün</th><th className="p-4">Ölçüler</th><th className="p-4">İşlem</th><th className="p-4">Firma / tarih</th><th className="p-4">Miktar</th><th className="p-4">Durum</th><th className="p-4">İrsaliye</th></tr></thead><tbody>{records.map((r) => <tr key={r.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/60"><td className="p-4"><b>{r.product_code}</b><div className="text-slate-400">{r.product_name}</div></td><td className="p-4 text-slate-300">Helis: {r.helix_length || "-"}<br />Çap: {r.diameter || "-"}<br />Tam: {r.full_length || "-"}</td><td className="p-4">{r.process_type}</td><td className="p-4">{r.company}<div className="text-slate-500">{r.sent_date}</div></td><td className="p-4">{r.returned_quantity || 0} / {r.quantity} {r.unit}<div className="text-xs text-amber-300">Kalan: {r.remaining_quantity}</div></td><td className="p-4"><StatusBadge status={r.status} /></td><td className="p-4">{r.waybill_number || "-"}{r.received_date && <div className="text-slate-500">{r.received_date}</div>}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}

// Keep the component self-contained; all mutations go through the authenticated API client.
// The page intentionally uses the product catalog as the source of selectable stock items.
// eslint-disable-next-line no-unused-vars
const _designNotes = { title: "Bilemeye Gidenler / Bilemeden Gelenler" };
