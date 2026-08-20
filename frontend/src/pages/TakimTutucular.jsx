import { useEffect, useState } from "react";
import api from "@/lib/api";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Wrench, ArrowDownToLine, ArrowUpFromLine,
  Loader2, X, History, FileSpreadsheet, Download
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ToolHolderImport from "@/components/ToolHolderImport";

const emptyForm = {
  name: "", brand: "", type: "", length: "", diameter: "",
  min_stock: 0, current_stock: 0, location: "", note: ""
};

const DEFAULT_TYPES = ["BT30", "BT40", "BT50", "HSK-A63", "HSK-A100", "ER Pens Tutucu", "Shrink Fit", "Weldon", "Diğer"];

const TURNING_SIZES = ["8x8", "10x10", "12x12", "16x16", "20x20", "25x25", "32x32", "40x40"];
const TURNING_CATALOG = [
  ...TURNING_SIZES.flatMap((size) => [
    { label: `PCLNR/L — dış tornalama — ${size}`, name: `PCLNR ${size} Dış Tornalama Kateri`, type: `CNC Torna / Dış Tornalama / ${size}`, length: "150", diameter: size },
    { label: `PDJNR/L — dış omuz — ${size}`, name: `PDJNR ${size} Dış Omuz Kateri`, type: `CNC Torna / Dış Omuz / ${size}`, length: "150", diameter: size },
  ]),
  { label: "MCLNR/L 2525M12 — ağır dış tornalama", name: "MCLNR 2525M12 Ağır Tornalama Kateri", type: "CNC Torna / Ağır Dış Tornalama", length: "150", diameter: "25x25" },
  { label: "SCLCR/L 1616H09 — pozitif dış tornalama", name: "SCLCR 1616H09 Pozitif Kater", type: "CNC Torna / Pozitif Tornalama", length: "100", diameter: "16x16" },
  { label: "DCLNR/L 2020K12 — dış tornalama", name: "DCLNR 2020K12 Dış Tornalama Kateri", type: "CNC Torna / Dış Tornalama", length: "125", diameter: "20x20" },
  { label: "SDJCR/L 2525M11 — profil/omuz", name: "SDJCR 2525M11 Profil Kateri", type: "CNC Torna / Profil ve Omuz", length: "150", diameter: "25x25" },
  { label: "SVJBR/L 3232P16 — profil/kopya", name: "SVJBR 3232P16 Profil Kateri", type: "CNC Torna / Profil / 32x32", length: "170", diameter: "32x32" },
  { label: "SCLCR 2020K09 — iç/pozitif", name: "SCLCR 2020K09 İç Tornalama Kateri", type: "CNC Torna / İç Tornalama", length: "125", diameter: "20x20" },
  { label: "SCLCR 2525M12 — iç/pozitif", name: "SCLCR 2525M12 İç Tornalama Kateri", type: "CNC Torna / İç Tornalama", length: "150", diameter: "25x25" },
  { label: "A12Q SCLCR09 — çelik boring bar", name: "A12Q SCLCR09 Çelik Boring Bar", type: "CNC Torna / Boring Bar / Çelik", length: "150", diameter: "12" },
  { label: "A16Q SCLCR09 — çelik boring bar", name: "A16Q SCLCR09 Çelik Boring Bar", type: "CNC Torna / Boring Bar / Çelik", length: "180", diameter: "16" },
  { label: "A20R SCLCR12 — çelik boring bar", name: "A20R SCLCR12 Çelik Boring Bar", type: "CNC Torna / Boring Bar / Çelik", length: "220", diameter: "20" },
  { label: "C16Q SCLCR09 — karbür boring bar", name: "C16Q SCLCR09 Karbür Boring Bar", type: "CNC Torna / Boring Bar / Karbür", length: "200", diameter: "16" },
  { label: "SER 2525M16 — dış vida", name: "SER 2525M16 Dış Vida Kateri", type: "CNC Torna / Dış Vida", length: "150", diameter: "25x25" },
  { label: "SEL 3232P16 — sol dış vida", name: "SEL 3232P16 Sol Dış Vida Kateri", type: "CNC Torna / Sol Dış Vida / 32x32", length: "170", diameter: "32x32" },
  { label: "SIR 1616H11 — iç vida", name: "SIR 1616H11 İç Vida Kateri", type: "CNC Torna / İç Vida", length: "125", diameter: "16" },
  { label: "SNR 2020K16 — iç vida", name: "SNR 2020K16 İç Vida Kateri", type: "CNC Torna / İç Vida", length: "150", diameter: "20x20" },
  { label: "MGEHR 1616-1.5 — dış kanal 1.5 mm", name: "MGEHR 1616-1.5 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 1.5 mm", length: "100", diameter: "16x16" },
  { label: "MGEHR 2020-2 — dış kanal 2 mm", name: "MGEHR 2020-2 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 2 mm", length: "125", diameter: "20x20" },
  { label: "MGEHR 2020-3 — dış kanal 3 mm", name: "MGEHR 2020-3 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 3 mm", length: "125", diameter: "20x20" },
  { label: "MGEHR 2525-3 — dış kanal 3 mm", name: "MGEHR 2525-3 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 3 mm", length: "150", diameter: "25x25" },
  { label: "MGEHR 2525-4 — dış kanal 4 mm", name: "MGEHR 2525-4 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 4 mm", length: "150", diameter: "25x25" },
  { label: "MGEHR 3232-4 — dış kanal 4 mm", name: "MGEHR 3232-4 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 4 mm / 32x32", length: "170", diameter: "32x32" },
  { label: "MGEHR 3232-5 — dış kanal 5 mm", name: "MGEHR 3232-5 Dış Kanal Kateri", type: "CNC Torna / Dış Kanal / 5 mm / 32x32", length: "170", diameter: "32x32" },
  { label: "MGEHL 2020-3 — sol dış kanal", name: "MGEHL 2020-3 Sol Dış Kanal Kateri", type: "CNC Torna / Sol Dış Kanal / 3 mm", length: "125", diameter: "20x20" },
  { label: "MGEHL 2525-4 — sol dış kanal", name: "MGEHL 2525-4 Sol Dış Kanal Kateri", type: "CNC Torna / Sol Dış Kanal / 4 mm", length: "150", diameter: "25x25" },
  { label: "MGEHL 3232-4 — sol dış kanal", name: "MGEHL 3232-4 Sol Dış Kanal Kateri", type: "CNC Torna / Sol Dış Kanal / 4 mm / 32x32", length: "170", diameter: "32x32" },
  { label: "MGIVR 2020-3 — dış kanal/kesme", name: "MGIVR 2020-3 Dış Kanal ve Kesme Kateri", type: "CNC Torna / Dış Kanal-Kesme / 3 mm", length: "125", diameter: "20x20" },
  { label: "MGIVL 2525-4 — sol kanal/kesme", name: "MGIVL 2525-4 Sol Kanal ve Kesme Kateri", type: "CNC Torna / Sol Kanal-Kesme / 4 mm", length: "150", diameter: "25x25" },
  { label: "MGMN 2020 — MGMN uçlu kanal", name: "MGMN 2020 Kanal Uçlu Kater", type: "CNC Torna / MGMN / Dış Kanal", length: "125", diameter: "20x20" },
  { label: "MGMN 2525 — MGMN uçlu kanal", name: "MGMN 2525 Kanal Uçlu Kater", type: "CNC Torna / MGMN / Dış Kanal", length: "150", diameter: "25x25" },
  { label: "N123 blade — kesme/kanal", name: "N123 Kesme ve Kanal Blade Tutucusu", type: "CNC Torna / N123 / Kesme-Kanal", length: "100", diameter: "25" },
  { label: "S tipi — iç kanal", name: "S Tipi İç Kanal Kateri", type: "CNC Torna / İç Kanal", length: "125", diameter: "16" },
  { label: "SSHF — iç kanal", name: "SSHF İç Kanal Kateri", type: "CNC Torna / İç Kanal / Hassas", length: "150", diameter: "20" },
  { label: "SSHT — iç vida/kanal", name: "SSHT İç Kanal ve Vida Kateri", type: "CNC Torna / İç Kanal-Vida", length: "150", diameter: "20" },
  { label: "Face grooving — alın kanalı", name: "Face Grooving Alın Kanalı Kateri", type: "CNC Torna / Alın Kanalı", length: "100", diameter: "20x20" },
  { label: "Face grooving — derin alın kanalı", name: "Derin Alın Kanalı Kateri", type: "CNC Torna / Derin Alın Kanalı", length: "125", diameter: "25x25" },
  { label: "MGEHR 2525-3 — genel kanal", name: "MGEHR 2525-3 Genel Kanal Kateri", type: "CNC Torna / Genel Kanal / 3 mm", length: "150", diameter: "25x25" },
  { label: "MGEHR 3232-4 — genel kanal", name: "MGEHR 3232-4 Genel Kanal Kateri", type: "CNC Torna / Genel Kanal / 4 mm / 32x32", length: "170", diameter: "32x32" },
  { label: "MGEHR 2020-2 — kesme", name: "MGEHR 2020-2 Kesme Kateri", type: "CNC Torna / Kesme / 2 mm", length: "125", diameter: "20x20" },
  { label: "MGEHR 2525-3 — kesme", name: "MGEHR 2525-3 Kesme Kateri", type: "CNC Torna / Kesme / 3 mm", length: "150", diameter: "25x25" },
  { label: "MGEHR 3232-4 — kesme", name: "MGEHR 3232-4 Kesme Kateri", type: "CNC Torna / Kesme / 4 mm / 32x32", length: "170", diameter: "32x32" },
  { label: "G tipi modüler — kanal/kesme", name: "G Tipi Modüler Kanal ve Kesme Tutucusu", type: "CNC Torna / Modüler Kanal-Kesme", length: "100", diameter: "25" },
];

const MILLING_CATALOG = [
  ...["BT30", "BT40", "BT50", "CAT40", "CAT50", "HSK-A63", "HSK-A100"].flatMap((interfaceType) => [
    { label: `${interfaceType} ER16 pens aynası`, name: `${interfaceType} ER16 Pens Aynası`, type: `CNC Dik İşleme / ${interfaceType} / ER16`, length: "80", diameter: "35" },
    { label: `${interfaceType} ER25 pens aynası`, name: `${interfaceType} ER25 Pens Aynası`, type: `CNC Dik İşleme / ${interfaceType} / ER25`, length: "100", diameter: "45" },
    { label: `${interfaceType} ER32 pens aynası`, name: `${interfaceType} ER32 Pens Aynası`, type: `CNC Dik İşleme / ${interfaceType} / ER32`, length: "100", diameter: "50" },
  ]),
  { label: "BT40 ER40 pens aynası", name: "BT40 ER40 Pens Aynası", type: "CNC Dik İşleme / BT40 / ER40", length: "110", diameter: "63" },
  { label: "BT40 Weldon Ø16", name: "BT40 Weldon Parmak Freze Tutucusu Ø16", type: "CNC Dik İşleme / BT40 / Weldon", length: "100", diameter: "50" },
  { label: "BT40 Weldon Ø20", name: "BT40 Weldon Parmak Freze Tutucusu Ø20", type: "CNC Dik İşleme / BT40 / Weldon", length: "100", diameter: "50" },
  { label: "BT40 Weldon Ø25", name: "BT40 Weldon Parmak Freze Tutucusu Ø25", type: "CNC Dik İşleme / BT40 / Weldon", length: "110", diameter: "50" },
  { label: "BT40 shrink-fit Ø16", name: "BT40 Shrink-Fit Tutucu Ø16", type: "CNC Dik İşleme / BT40 / Shrink-Fit", length: "100", diameter: "50" },
  { label: "BT40 shrink-fit Ø20", name: "BT40 Shrink-Fit Tutucu Ø20", type: "CNC Dik İşleme / BT40 / Shrink-Fit", length: "100", diameter: "50" },
  { label: "HSK-A63 shrink-fit Ø20", name: "HSK-A63 Shrink-Fit Tutucu Ø20", type: "CNC Dik İşleme / HSK-A63 / Shrink-Fit", length: "100", diameter: "50" },
  { label: "BT40 hidrolik Ø20", name: "BT40 Hidrolik Tutucu Ø20", type: "CNC Dik İşleme / BT40 / Hidrolik", length: "110", diameter: "50" },
  { label: "HSK-A63 hidrolik Ø20", name: "HSK-A63 Hidrolik Tutucu Ø20", type: "CNC Dik İşleme / HSK-A63 / Hidrolik", length: "120", diameter: "50" },
  { label: "BT40 yüzey freze arboru Ø22", name: "BT40 Yüzey Freze Arboru Ø22", type: "CNC Dik İşleme / BT40 / Face Mill", length: "80", diameter: "63" },
  { label: "BT50 yüzey freze arboru Ø27", name: "BT50 Yüzey Freze Arboru Ø27", type: "CNC Dik İşleme / BT50 / Face Mill", length: "100", diameter: "80" },
  { label: "BT40 kılavuz tension/compression", name: "BT40 Tension Compression Kılavuz Tutucusu", type: "CNC Dik İşleme / BT40 / Kılavuz", length: "100", diameter: "50" },
  { label: "BT40 rigid tapping", name: "BT40 Rigid Tapping Tutucusu", type: "CNC Dik İşleme / BT40 / Rigid Tapping", length: "100", diameter: "50" },
  { label: "BT50 boring head adaptörü", name: "BT50 Boring Head Adaptörü", type: "CNC Dik İşleme / BT50 / Boring", length: "150", diameter: "75" },
  { label: "BT40 Morse taper adaptörü", name: "BT40 Morse Taper Adaptörü", type: "CNC Dik İşleme / BT40 / Morse", length: "120", diameter: "50" },
  { label: "BT40 Jacobs taper adaptörü", name: "BT40 Jacobs Taper Adaptörü", type: "CNC Dik İşleme / BT40 / Jacobs", length: "120", diameter: "50" },
  { label: "BT40 slitting saw arboru", name: "BT40 Slitting Saw Arboru", type: "CNC Dik İşleme / BT40 / Slitting Saw", length: "100", diameter: "50" },
  { label: "BT40 modüler adaptör", name: "BT40 Modüler Takım Tutucu Adaptörü", type: "CNC Dik İşleme / BT40 / Modüler", length: "100", diameter: "50" },
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

  const exportExcel = () => {
    const rows = filtered.map((t) => ({
      "Tutucu Adı": t.name || "",
      "Marka": t.brand || "",
      "Tipi": t.type || "",
      "Boy (mm)": t.length || "",
      "Çap (mm)": t.diameter || "",
      "Konum": t.location || "",
      "Minimum Stok": t.min_stock ?? 0,
      "Mevcut Stok": t.current_stock ?? 0,
      "Stok Durumu": Number(t.current_stock || 0) <= Number(t.min_stock || 0) ? "Kritik" : "Normal",
      "Not": t.note || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 32 }, { wch: 18 }, { wch: 34 }, { wch: 12 }, { wch: 12 },
      { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 36 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Takım Tutucular");
    const suffix = q.trim() ? "filtreli" : "tam-liste";
    XLSX.writeFile(workbook, `takim-tutucular-${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} takım tutucu Excel'e aktarıldı`);
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
            <button onClick={exportExcel} data-testid="th-export-btn"
              className="h-14 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white font-semibold flex items-center gap-2 active:scale-95">
              <Download className="w-5 h-5" /> Excel'e Dışa Aktar
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
