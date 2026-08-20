import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Wrench, ArrowDownToLine, ArrowUpFromLine,
  Loader2, X, History, FileSpreadsheet
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ToolHolderImport from "@/components/ToolHolderImport";

const emptyForm = {
  name: "", brand: "", type: "", length: "", diameter: "",
  min_stock: 0, current_stock: 0, location: "", note: ""
};

const DEFAULT_TYPES = ["BT30", "BT40", "BT50", "HSK-A63", "HSK-A100", "ER Pens Tutucu", "Shrink Fit", "Weldon", "Diğer"];

const TURNING_CATALOG = [
  { label: "Dış tornalama — PCLNR 2525M12", name: "PCLNR 2525M12 Dış Tornalama Kateri", type: "CNC Torna Kateri / Dış Tornalama", length: "150", diameter: "25x25" },
  { label: "Dış tornalama — PDJNR 2525M15", name: "PDJNR 2525M15 Dış Tornalama Kateri", type: "CNC Torna Kateri / Dış Tornalama", length: "150", diameter: "25x25" },
  { label: "Pozitif dış tornalama — SCLCR 1616H09", name: "SCLCR 1616H09 Pozitif Kater", type: "CNC Torna Kateri / Pozitif Tornalama", length: "100", diameter: "16x16" },
  { label: "İç tornalama — SSSCR 1616H09", name: "SSSCR 1616H09 İç Tornalama Kateri", type: "CNC Torna Kateri / İç Tornalama", length: "125", diameter: "16" },
  { label: "İç boring bar — A16Q SCLCR09", name: "A16Q SCLCR09 Boring Bar", type: "CNC Torna Kateri / Boring Bar", length: "180", diameter: "16" },
  { label: "Dış vida — SER 2525M16", name: "SER 2525M16 Dış Vida Kateri", type: "CNC Torna Kateri / Vida Açma", length: "150", diameter: "25x25" },
  { label: "İç vida — SIR 1616H11", name: "SIR 1616H11 İç Vida Kateri", type: "CNC Torna Kateri / İç Vida", length: "125", diameter: "16" },
  { label: "Kanal açma — MGEHR 2525-3", name: "MGEHR 2525-3 Kanal Kateri", type: "CNC Torna Kateri / Kanal Açma", length: "150", diameter: "25x25" },
  { label: "Kesme — MGEHR 2020-2", name: "MGEHR 2020-2 Kesme Kateri", type: "CNC Torna Kateri / Kesme", length: "125", diameter: "20x20" },
  { label: "Profil/kopya — SVJBR 2525M16", name: "SVJBR 2525M16 Profil Kateri", type: "CNC Torna Kateri / Profil", length: "150", diameter: "25x25" },
];

const MILLING_CATALOG = [
  { label: "BT40 ER32 pens aynası", name: "BT40 ER32 Pens Aynası", type: "CNC Dik İşleme / BT40 ER32", length: "100", diameter: "50" },
  { label: "BT40 ER20 pens aynası", name: "BT40 ER20 Pens Aynası", type: "CNC Dik İşleme / BT40 ER20", length: "100", diameter: "42" },
  { label: "BT40 Weldon Ø20", name: "BT40 Weldon Parmak Freze Tutucusu Ø20", type: "CNC Dik İşleme / Weldon", length: "100", diameter: "50" },
  { label: "BT40 shrink-fit Ø16", name: "BT40 Shrink-Fit Tutucu Ø16", type: "CNC Dik İşleme / Shrink-Fit", length: "100", diameter: "50" },
  { label: "BT40 hidrolik Ø20", name: "BT40 Hidrolik Tutucu Ø20", type: "CNC Dik İşleme / Hidrolik", length: "110", diameter: "50" },
  { label: "BT40 yüzey freze arboru", name: "BT40 Yüzey Freze Arboru", type: "CNC Dik İşleme / Face Mill Arbor", length: "80", diameter: "63" },
  { label: "BT40 kılavuz çekme tutucusu", name: "BT40 Kılavuz Çekme Tutucusu", type: "CNC Dik İşleme / Kılavuz", length: "100", diameter: "50" },
  { label: "BT50 boring head adaptörü", name: "BT50 Boring Head Adaptörü", type: "CNC Dik İşleme / Boring", length: "150", diameter: "75" },
  { label: "HSK-A63 ER32 pens aynası", name: "HSK-A63 ER32 Pens Aynası", type: "CNC Dik İşleme / HSK-A63 ER32", length: "100", diameter: "50" },
  { label: "CAT40 ER25 pens aynası", name: "CAT40 ER25 Pens Aynası", type: "CNC Dik İşleme / CAT40 ER25", length: "100", diameter: "45" },
  { label: "BT30 ER16 pens aynası", name: "BT30 ER16 Pens Aynası", type: "CNC Dik İşleme / BT30 ER16", length: "80", diameter: "35" },
];

export default function TakimTutucular() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [machines, setMachines] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [stockAction, setStockAction] = useState(null); // { holder, type: 'in'|'out' }
  const [stockForm, setStockForm] = useState({ quantity: "", machine_id: "", personnel_id: "", supplier: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [movementsFor, setMovementsFor] = useState(null);
  const [movements, setMovements] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [catalogKind, setCatalogKind] = useState("");

  const load = () => Promise.all([
    api.get("/toolholders").then((r) => setItems(r.data)),
    api.get("/machines").then((r) => setMachines(r.data)).catch(() => setMachines([])),
    api.get("/personnel").then((r) => setPersonnel(r.data)).catch(() => setPersonnel([])),
  ]);
  useEffect(() => { load(); }, []);

  const filtered = items.filter((t) => {
    const s = q.toLowerCase();
    if (!s) return true;
    return (t.name || "").toLowerCase().includes(s)
      || (t.brand || "").toLowerCase().includes(s)
      || (t.type || "").toLowerCase().includes(s)
      || (t.length || "").toLowerCase().includes(s)
      || (t.diameter || "").toLowerCase().includes(s)
      || (t.location || "").toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      min_stock: parseFloat(form.min_stock) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
    };
    try {
      if (editId) await api.put(`/toolholders/${editId}`, payload);
      else await api.post("/toolholders", payload);
      toast.success(editId ? "Tutucu güncellendi" : "Tutucu eklendi");
      setShowForm(false); setEditId(null); setForm(emptyForm); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const edit = (t) => { setForm({ ...emptyForm, ...t }); setCatalogKind(""); setEditId(t.id); setShowForm(true); };
  const applyCatalogPreset = (value) => {
    setCatalogKind(value);
    if (!value || value === "manual") return;
    const [group, index] = value.split(":");
    const preset = (group === "turning" ? TURNING_CATALOG : MILLING_CATALOG)[Number(index)];
    if (preset) setForm((old) => ({ ...old, name: preset.name, type: preset.type, length: preset.length, diameter: preset.diameter }));
  };
  const del = async (t) => {
    if (!window.confirm(`"${t.name}" tutucusu silinsin mi?`)) return;
    try { await api.delete(`/toolholders/${t.id}`); toast.success("Silindi"); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const openStock = (holder, type) => {
    setStockAction({ holder, type });
    setStockForm({ quantity: "", machine_id: "", personnel_id: "", supplier: "", note: "" });
  };

  const submitStock = async (e) => {
    e.preventDefault();
    const qty = parseFloat(stockForm.quantity);
    if (!qty || qty <= 0) return toast.error("Miktar girin");
    if (stockAction.type === "out" && !stockForm.machine_id) return toast.error("Tezgah seçin");
    setSaving(true);
    try {
      const url = `/toolholders/${stockAction.holder.id}/${stockAction.type}`;
      const body = stockAction.type === "in"
        ? { quantity: qty, supplier: stockForm.supplier || "", note: stockForm.note || "" }
        : { quantity: qty, machine_id: stockForm.machine_id, personnel_id: stockForm.personnel_id || null, note: stockForm.note || "" };
      const r = await api.post(url, body);
      toast.success(stockAction.type === "in"
        ? `Takımhaneye girişi kaydedildi. Yeni stok: ${r.data.new_stock}`
        : `Tezgaha çıkışı kaydedildi. Yeni stok: ${r.data.new_stock}`);
      setStockAction(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
    setSaving(false);
  };

  const openMovements = async (holder) => {
    try {
      const r = await api.get("/toolholder-movements", { params: { tool_holder_id: holder.id } });
      setMovements(r.data);
      setMovementsFor(holder);
    } catch { toast.error("Hareketler yüklenemedi"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Bağlantı Ekipmanı
          </div>
          <h1 className="font-display text-4xl font-black">Takım Tutucular</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} tutucu</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setForm(emptyForm); setCatalogKind(""); setEditId(null); setShowForm(true); }} data-testid="th-add-btn"
              className="h-14 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-900/30">
              <Plus className="w-5 h-5" /> Yeni Tutucu
            </button>
            <button onClick={() => setShowImport(true)} data-testid="th-import-btn"
              className="h-14 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold flex items-center gap-2 active:scale-95">
              <FileSpreadsheet className="w-5 h-5" /> Excel'den İçe Aktar
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="th-search"
          placeholder="Ad, marka, tip, boy, çap, konum ara..."
          className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={submit} data-testid="th-form" className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 bg-blue-950/30 border border-blue-800/40 rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Standart kater / tutucu seçimi</div>
            <p className="text-xs text-slate-400">Aşağıdan hazır bir tip seçtiğinde ad, tip, boy ve çap önerilir. Aşağıdaki tüm alanlar manuel olarak değiştirilebilir.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select value={catalogKind} onChange={(e) => applyCatalogPreset(e.target.value)} data-testid="th-f-catalog" className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 md:col-span-2">
                <option value="">Katalogdan seçin veya Manuel Değiştir</option>
                <optgroup label="CNC Torna Katerleri">{TURNING_CATALOG.map((p, i) => <option key={`turning-${i}`} value={`turning:${i}`}>{p.label}</option>)}</optgroup>
                <optgroup label="CNC Dik İşleme Takım Tutucuları">{MILLING_CATALOG.map((p, i) => <option key={`milling-${i}`} value={`milling:${i}`}>{p.label}</option>)}</optgroup>
                <option value="manual">Manuel Değiştir</option>
              </select>
              <div className="h-12 rounded-lg border border-slate-700 bg-slate-950/60 px-3 flex items-center text-xs text-slate-400">Seçim sonrası alanları değiştirebilirsin.</div>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tutucu Adı <span className="text-blue-400 normal-case">(manuel değiştirilebilir)</span></label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="th-f-name" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Marka</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} data-testid="th-f-brand" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" placeholder="ör. Regofix, Big Kaiser" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tipi <span className="text-blue-400 normal-case">(manuel değiştirilebilir)</span></label>
            <input list="th-types" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="th-f-type" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" placeholder="ör. BT40, HSK-A63" />
            <datalist id="th-types">{DEFAULT_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Boy (mm)</label>
            <input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} data-testid="th-f-length" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" placeholder="ör. 120" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Çap (mm)</label>
            <input value={form.diameter} onChange={(e) => setForm({ ...form, diameter: e.target.value })} data-testid="th-f-diameter" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" placeholder="ör. 32" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Konum</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="th-f-location" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" placeholder="Raf / Dolap" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Minimum Stok</label>
            <input type="number" step="1" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} data-testid="th-f-min" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 font-mono-tab" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Mevcut Stok</label>
            <input type="number" step="1" min="0" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} data-testid="th-f-current" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 font-mono-tab" />
          </div>
          <div className="md:col-span-3 flex gap-3">
            <button type="submit" data-testid="th-f-submit" className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold">Kaydet</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">İptal</button>
          </div>
        </form>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr className="text-left text-slate-400 uppercase tracking-wider text-xs">
                <th className="px-4 py-3">Adı</th>
                <th className="px-4 py-3">Markası</th>
                <th className="px-4 py-3">Tipi</th>
                <th className="px-4 py-3 text-right">Boy</th>
                <th className="px-4 py-3 text-right">Çap</th>
                <th className="px-4 py-3">Konum</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((t) => {
                const crit = t.current_stock <= t.min_stock;
                return (
                  <tr key={t.id} data-testid={`th-row-${t.id}`} className={`h-16 hover:bg-slate-700/40 ${crit ? "bg-red-950/20" : ""}`}>
                    <td className="px-4 font-medium">{t.name}</td>
                    <td className="px-4 text-slate-300">{t.brand || <span className="text-slate-600">-</span>}</td>
                    <td className="px-4 text-slate-300">{t.type || <span className="text-slate-600">-</span>}</td>
                    <td className="px-4 text-right font-mono-tab text-slate-300">{t.length || "-"}</td>
                    <td className="px-4 text-right font-mono-tab text-slate-300">{t.diameter || "-"}</td>
                    <td className="px-4 text-slate-400">{t.location || <span className="text-slate-600">-</span>}</td>
                    <td className={`px-4 text-right font-mono-tab font-bold ${crit ? "text-red-400" : ""}`}>{t.current_stock}</td>
                    <td className="px-4">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {isAdmin && (
                          <>
                            <button onClick={() => openStock(t, "in")} data-testid={`th-in-${t.id}`} title="Takımhaneye Giriş"
                              className="h-9 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-600/40 text-xs font-semibold flex items-center gap-1">
                              <ArrowDownToLine className="w-3.5 h-3.5" /> Giriş
                            </button>
                            <button onClick={() => openStock(t, "out")} data-testid={`th-out-${t.id}`} title="Tezgaha Çıkış"
                              className="h-9 px-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-600/40 text-xs font-semibold flex items-center gap-1">
                              <ArrowUpFromLine className="w-3.5 h-3.5" /> Çıkış
                            </button>
                          </>
                        )}
                        <button onClick={() => openMovements(t)} title="Hareketler"
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><History className="w-4 h-4" /></button>
                        {isAdmin && (
                          <>
                            <button onClick={() => edit(t)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => del(t)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Tutucu yok. Yukarıdan ekleyin.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {stockAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <div className={`text-xs uppercase tracking-[0.2em] font-semibold ${stockAction.type === "in" ? "text-emerald-400" : "text-amber-400"}`}>
                  {stockAction.type === "in" ? "Takımhaneye Giriş" : "Tezgaha Çıkış"}
                </div>
                <div className="font-display text-lg font-bold">{stockAction.holder.name}</div>
                <div className="text-xs text-slate-500">Mevcut: {stockAction.holder.current_stock}</div>
              </div>
              <button onClick={() => setStockAction(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitStock} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Miktar</label>
                <input required type="number" step="1" min="1" value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  data-testid="th-stock-qty"
                  className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-2xl font-bold font-mono-tab focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              {stockAction.type === "out" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Bağlanacak Tezgah</label>
                    <select required value={stockForm.machine_id}
                      onChange={(e) => setStockForm({ ...stockForm, machine_id: e.target.value })}
                      data-testid="th-stock-machine"
                      className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                      <option value="">-- Tezgah seçin --</option>
                      {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Personel (opsiyonel)</label>
                    <select value={stockForm.personnel_id}
                      onChange={(e) => setStockForm({ ...stockForm, personnel_id: e.target.value })}
                      className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3">
                      <option value="">-- Yok --</option>
                      {personnel.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {stockAction.type === "in" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tedarikçi / Kaynak (opsiyonel)</label>
                  <input value={stockForm.supplier}
                    onChange={(e) => setStockForm({ ...stockForm, supplier: e.target.value })}
                    className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Not</label>
                <textarea rows={2} value={stockForm.note}
                  onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} data-testid="th-stock-submit"
                  className={`h-12 px-6 rounded-lg text-white font-bold flex items-center gap-2 disabled:opacity-50 ${stockAction.type === "in" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-600 hover:bg-amber-500"}`}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Kaydet
                </button>
                <button type="button" onClick={() => setStockAction(null)} className="h-12 px-6 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {movementsFor && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">Hareket Geçmişi</div>
                <div className="font-display text-lg font-bold">{movementsFor.name}</div>
              </div>
              <button onClick={() => setMovementsFor(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-auto">
              {movements.length === 0 ? (
                <div className="text-center text-slate-500 py-8">Bu tutucu için henüz hareket yok.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Tarih</th>
                      <th className="px-3 py-2 text-left">Tip</th>
                      <th className="px-3 py-2 text-right">Miktar</th>
                      <th className="px-3 py-2 text-left">Nereye / Kim</th>
                      <th className="px-3 py-2 text-left">Not</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${m.type === "in" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30"}`}>
                            {m.type === "in" ? "Takımhane" : "Tezgah"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono-tab font-bold">{m.quantity}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {m.type === "out" ? `${m.machine_code || ""} ${m.machine_name || ""}${m.personnel_name ? ` · ${m.personnel_name}` : ""}` : (m.supplier || "-")}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{m.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {showImport && <ToolHolderImport onClose={() => setShowImport(false)} onCommitted={load} />}
    </div>
  );
}
