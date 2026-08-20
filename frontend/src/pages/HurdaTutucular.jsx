import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, PackageX, Search, Download, ShieldAlert } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = "w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100 outline-none focus:ring-2 focus:ring-red-500";
const labelClass = "block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider";

const emptyForm = { holder_id: "", quantity: "", scrap_reason: "", description: "", scrap_date: today(), location: "", approved_by: "", witness: "" };
const reasons = ["Kırıldı", "Ezildi / deforme oldu", "Aşındı", "Ölçü toleransı dışına çıktı", "Yanlış kullanım kaynaklı hasar", "Korozyon / paslanma", "Kayboldu / bulunamıyor", "Diğer"];

export default function HurdaTutucular() {
  const [holders, setHolders] = useState([]);
  const [scraps, setScraps] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([api.get("/toolholders"), api.get("/toolholder-scraps")]);
      setHolders(h.data || []); setScraps(s.data || []);
    } catch (e) { toast.error(e.response?.data?.detail || "Hurda kayıtları yüklenemedi"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holders.filter((h) => !q || `${h.name} ${h.brand || ""} ${h.type || ""} ${h.cutting_tool_code_name || ""}`.toLowerCase().includes(q));
  }, [holders, search]);
  const selected = holders.find((h) => h.id === form.holder_id);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.holder_id) return toast.error("Tutucu seçiniz");
    if (!form.scrap_reason.trim()) return toast.error("Hurda nedeni seçiniz veya yazınız");
    if (!Number(form.quantity) || Number(form.quantity) <= 0) return toast.error("Geçerli hurda miktarı giriniz");
    if (Number(form.quantity) > Number(selected?.current_stock || 0)) return toast.error("Hurda miktarı mevcut stoktan fazla olamaz");
    if (!window.confirm(`${selected.name} tutucusundan ${form.quantity} adet hurdaya ayrılacak ve stoktan düşülecek. Devam edilsin mi?`)) return;
    setSaving(true);
    try {
      const r = await api.post(`/toolholders/${form.holder_id}/scrap`, { quantity: Number(form.quantity), scrap_reason: form.scrap_reason, description: form.description, scrap_date: form.scrap_date, location: form.location, approved_by: form.approved_by, witness: form.witness });
      toast.success(`Hurda kaydı oluşturuldu. Yeni stok: ${r.data.new_stock}`);
      setForm(emptyForm); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Hurda kaydı oluşturulamadı"); }
    finally { setSaving(false); }
  };

  const downloadPdf = async (scrap) => {
    try {
      const r = await api.get(`/toolholder-scraps/${scrap.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = `hurda-tutanagi-${scrap.id.slice(0, 8)}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.response?.data?.detail || "PDF tutanak indirilemedi"); }
  };

  return <div className="space-y-7">
    <div className="flex items-end justify-between gap-4 flex-wrap"><div><div className="text-xs text-red-500 uppercase tracking-[0.2em] font-bold mb-2">Stoktan Kullanım Dışı Ayırma</div><h1 className="font-display text-4xl font-black">Takım Tutucu Hurda / Kullanım Dışı</h1><p className="text-slate-700 mt-2 font-semibold">Kırılan, ezilen veya kullanılamaz duruma gelen tutucuları gerekçesiyle kaydedin ve stoktan düşürün.</p></div><div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800 font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Hurda işlemi stoktan düşer</div></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-slate-600 font-bold text-sm">Tutucu çeşidi</div><div className="text-3xl font-black mt-2 text-slate-950">{holders.length}</div></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-slate-600 font-bold text-sm">Hurda kaydı</div><div className="text-3xl font-black mt-2 text-red-700">{scraps.length}</div></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-slate-600 font-bold text-sm">Toplam hurda miktarı</div><div className="text-3xl font-black mt-2 text-amber-700">{scraps.reduce((n, s) => n + Number(s.quantity || 0), 0)} adet</div></div></div>
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm"><div className="flex items-center gap-3 text-red-700 font-black text-lg"><PackageX className="w-6 h-6" />Hurda tutanağı oluştur</div>
      <div><label className={labelClass}>Tutucu ara</label><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, marka, tip veya kesici uç kodu..." className={`${inputClass} pl-10`} /></div></div>
      <div><label className={labelClass}>Hurdaya ayrılacak takım tutucu</label><select required value={form.holder_id} onChange={(e) => set("holder_id", e.target.value)} className={inputClass}><option value="">-- Stoktan tutucu seçin --</option>{filtered.map((h) => <option key={h.id} value={h.id}>{h.name} | {h.brand || "-"} | Stok: {h.current_stock} adet</option>)}</select></div>
      {selected && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm"><div><span className="text-slate-500 block font-bold">Tutucu</span><b>{selected.name}</b></div><div><span className="text-slate-500 block font-bold">Marka</span>{selected.brand || "-"}</div><div><span className="text-slate-500 block font-bold">Tip</span>{selected.type || "-"}</div><div><span className="text-slate-500 block font-bold">Ölçü</span>Boy {selected.length || "-"} / Çap {selected.diameter || "-"}</div><div><span className="text-slate-500 block font-bold">Mevcut stok</span><b className="text-emerald-700">{selected.current_stock} adet</b></div></div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><label className={labelClass}>Hurda miktarı</label><input required type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Hurda nedeni</label><select required value={form.scrap_reason} onChange={(e) => set("scrap_reason", e.target.value)} className={inputClass}><option value="">-- Neden seçin --</option>{reasons.map((r) => <option key={r}>{r}</option>)}</select></div><div><label className={labelClass}>Hurda tarihi</label><input required type="date" value={form.scrap_date} onChange={(e) => set("scrap_date", e.target.value)} className={inputClass} /></div><div><label className={labelClass}>Konum / hurda alanı</label><input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Hurda alanı" className={inputClass} /></div></div>
      <div><label className={labelClass}>Neden ve hasar açıklaması</label><textarea required value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Hasarın nasıl oluştuğunu, ezilme/kırılma durumunu ve tespit notlarını yazın..." className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 outline-none focus:ring-2 focus:ring-red-500" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className={labelClass}>Onaylayan</label><input value={form.approved_by} onChange={(e) => set("approved_by", e.target.value)} placeholder="Ad soyad / unvan" className={inputClass} /></div><div><label className={labelClass}>Tanık / teslim alan</label><input value={form.witness} onChange={(e) => set("witness", e.target.value)} placeholder="Ad soyad / unvan" className={inputClass} /></div></div>
      <button disabled={saving || loading} className="h-14 px-6 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black flex items-center gap-2">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} Hurdaya Ayır ve Tutanağı Kaydet</button>
    </form>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"><div className="p-5 border-b border-slate-200 flex items-center gap-2"><FileText className="w-5 h-5 text-red-700" /><h2 className="font-black text-lg text-slate-950">Hurda kayıtları ve tutanaklar</h2></div>{loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div> : scraps.length === 0 ? <div className="p-8 text-center text-slate-600 font-semibold">Henüz hurda kaydı yok.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-700 border-b border-slate-200"><th className="p-4">Tarih</th><th className="p-4">Tutucu</th><th className="p-4">Miktar</th><th className="p-4">Hurda nedeni</th><th className="p-4">Açıklama</th><th className="p-4">İşlem</th></tr></thead><tbody>{scraps.map((s) => <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-4 font-bold text-slate-900">{s.scrap_date}</td><td className="p-4"><b>{s.name}</b><div className="text-slate-600">{s.brand || "-"} · {s.holder_type || "-"}</div></td><td className="p-4 font-black text-red-700">{s.quantity} adet</td><td className="p-4 font-bold text-slate-900">{s.scrap_reason}</td><td className="p-4 text-slate-700 max-w-sm">{s.description || "-"}</td><td className="p-4"><button type="button" onClick={() => downloadPdf(s)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-black"><Download className="w-4 h-4" /> PDF Tutanak</button></td></tr>)}</tbody></table></div>}</div>
  </div>;
}
