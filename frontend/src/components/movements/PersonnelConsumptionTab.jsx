import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { downloadReportWorkbook } from "@/lib/reportExcel";
import MovementImport from "./MovementImport";
import { ActionButtons, DateRangeFields, EmptyRow, Kpi, formatDay, monthStartISO, todayISO } from "./shared";

const TOOL_COLUMNS = [
  { header: "Tarih", key: "date", type: "date", width: 12 },
  { header: "Ürün Kodu", key: "code", width: 16 },
  { header: "Ürün Adı", key: "name", width: 30 },
  { header: "Marka", key: "brand", width: 16 },
  { header: "Kategori", key: "category", width: 16 },
  { header: "Kalite", key: "quality", width: 12 },
  { header: "Miktar", key: "quantity", type: "number", width: 10 },
  { header: "Birim", key: "unit", width: 8 },
  { header: "Personel", key: "personnel", width: 22 },
  { header: "Tezgâh Kodu", key: "machine_code", width: 12 },
  { header: "Tezgâh", key: "machine", width: 18 },
  { header: "Takım Tutucu", key: "toolholder", width: 20 },
  { header: "Üretim / İşlenen Ürün", key: "production", width: 24 },
  { header: "Çıkış Nedeni", key: "exit_reason", width: 20 },
  { header: "Not", key: "note", width: 24 },
  { header: "Kullanıcı", key: "user", width: 16 },
];

const GLOVE_COLUMNS = [
  { header: "Tarih", key: "date", type: "date", width: 12 },
  { header: "Eldiven", key: "glove", width: 26 },
  { header: "Beden", key: "size", width: 10 },
  { header: "Marka", key: "brand", width: 16 },
  { header: "Miktar", key: "quantity", type: "number", width: 10 },
  { header: "Personel", key: "personnel", width: 22 },
  { header: "Not", key: "note", width: 26 },
  { header: "Kullanıcı", key: "user", width: 16 },
];

export default function PersonnelConsumptionTab() {
  const [personnel, setPersonnel] = useState([]);
  const [personnelId, setPersonnelId] = useState("");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (personnelId) params.personnel_id = personnelId;
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const response = await api.get("/reports/personnel-consumption", { params });
      setData(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Personel sarfiyat listesi yüklenemedi");
    }
    setLoading(false);
  }, [personnelId, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/personnel").then((r) => setPersonnel(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const selectedPerson = personnel.find((p) => p.id === personnelId);
  const selectedName = selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : "Tüm personel";
  const summary = data?.summary || {};
  const tools = data?.tools || [];
  const gloves = data?.gloves || [];
  const byPersonnel = data?.by_personnel || [];

  const exportExcel = () => {
    if (!tools.length && !gloves.length) return toast.info("Dışa aktarılacak sarfiyat kaydı bulunamadı");
    const period = `${from ? formatDay(from) : "başlangıç"} - ${to ? formatDay(to) : "bugün"}`;
    const toolRows = tools.map((row) => ({
      date: row.date, code: row.product_code, name: row.product_name, brand: row.brand,
      category: row.category, quality: row.quality, quantity: row.quantity, unit: row.unit,
      personnel: row.personnel_name, machine_code: row.machine_code, machine: row.machine_name,
      toolholder: [row.toolholder_code, row.toolholder_name].filter(Boolean).join(" — "),
      production: row.production_product, exit_reason: row.exit_reason, note: row.note, user: row.user_name,
    }));
    const gloveRows = gloves.map((row) => ({
      date: row.date, glove: row.glove_name, size: row.size, brand: row.brand,
      quantity: row.quantity, personnel: row.personnel_name, note: row.note, user: row.user_name,
    }));
    const summaryRows = byPersonnel.map((row) => ({
      personnel: row.personnel_name, tool_quantity: row.tool_quantity, tool_lines: row.tool_lines,
      glove_quantity: row.glove_quantity, glove_lines: row.glove_lines,
    }));

    downloadReportWorkbook({
      filename: `personel-sarfiyat-${from || "tum"}-${to || "tum"}.xlsx`,
      sheets: [
        {
          name: "Takım Sarfiyatı",
          title: "YAZKAN İŞLEME — PERSONEL TAKIM / ELMAS / UÇ SARFİYATI",
          subtitle: `Personel: ${selectedName} · Dönem: ${period}`,
          columns: TOOL_COLUMNS,
          rows: toolRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
        {
          name: "Eldiven Sarfiyatı",
          title: "YAZKAN İŞLEME — PERSONEL ELDİVEN SARFİYATI",
          subtitle: `Personel: ${selectedName} · Dönem: ${period}`,
          columns: GLOVE_COLUMNS,
          rows: gloveRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
        {
          name: "Personel Özeti",
          title: "YAZKAN İŞLEME — PERSONEL SARFİYAT ÖZETİ",
          subtitle: `Dönem: ${period}`,
          columns: [
            { header: "Personel", key: "personnel", width: 28 },
            { header: "Takım Adedi", key: "tool_quantity", type: "number", width: 14 },
            { header: "Takım Satırı", key: "tool_lines", type: "number", width: 14 },
            { header: "Eldiven Adedi", key: "glove_quantity", type: "number", width: 14 },
            { header: "Eldiven Satırı", key: "glove_lines", type: "number", width: 14 },
          ],
          rows: summaryRows,
          footer: { label: "TOPLAM", sumKeys: ["tool_quantity", "tool_lines", "glove_quantity", "glove_lines"] },
        },
      ],
    });
    toast.success("Personel sarfiyat Excel'i indirildi");
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Personel</label>
          <select value={personnelId} onChange={(event) => setPersonnelId(event.target.value)} data-testid="pc-personnel"
            className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100 min-w-[240px]">
            <option value="">Tüm personel</option>
            {personnel.map((person) => (
              <option key={person.id} value={person.id}>{person.first_name} {person.last_name}{person.department ? ` — ${person.department}` : ""}</option>
            ))}
          </select>
        </div>
        <DateRangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button onClick={() => { setPersonnelId(""); setFrom(monthStartISO()); setTo(todayISO()); }}
          className="h-12 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Temizle</button>
        <ActionButtons onExport={exportExcel} onImport={() => setImportOpen(true)} exportDisabled={!tools.length && !gloves.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Takım / Elmas / Uç" value={summary.tool_quantity ?? 0} tone="blue" suffix="adet" />
        <Kpi label="Eldiven" value={summary.glove_quantity ?? 0} tone="amber" suffix="çift" />
        <Kpi label="Kayıt Satırı" value={(summary.tool_lines ?? 0) + (summary.glove_lines ?? 0)} />
        <Kpi label="Personel" value={summary.personnel_count ?? 0} tone="emerald" />
      </div>

      {selectedPerson && (
        <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 px-4 py-3 text-sm text-slate-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-300" />
          <span><span className="font-bold text-blue-300">{selectedName}</span> için {formatDay(from)} – {formatDay(to)} aralığındaki kullanım detayları gösteriliyor.</span>
        </div>
      )}

      {loading && <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...</div>}

      {!personnelId && byPersonnel.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <div className="font-bold text-slate-100">Personel Özeti</div>
            <div className="text-xs text-slate-500">Detay için personele tıklayın</div>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Personel</th>
                  <th className="px-4 py-2 text-right">Takım Adedi</th>
                  <th className="px-4 py-2 text-right">Takım Satırı</th>
                  <th className="px-4 py-2 text-right">Eldiven Adedi</th>
                  <th className="px-4 py-2 text-right">Eldiven Satırı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {byPersonnel.map((row) => (
                  <tr key={row.personnel_id || row.personnel_name} className="hover:bg-slate-700/40 cursor-pointer"
                    onClick={() => row.personnel_id && setPersonnelId(row.personnel_id)}>
                    <td className="px-4 py-2 font-semibold text-slate-100">{row.personnel_name}</td>
                    <td className="px-4 py-2 text-right font-mono-tab text-blue-300">{row.tool_quantity}</td>
                    <td className="px-4 py-2 text-right font-mono-tab text-slate-400">{row.tool_lines}</td>
                    <td className="px-4 py-2 text-right font-mono-tab text-amber-300">{row.glove_quantity}</td>
                    <td className="px-4 py-2 text-right font-mono-tab text-slate-400">{row.glove_lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-bold text-slate-100">Takım / Elmas / Uç Kullanımı</div>
          <div className="text-xs text-slate-500">{tools.length} satır</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Ürün</th>
                <th className="px-3 py-2 text-left">Marka / Kategori / Kalite</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2 text-left">Personel</th>
                <th className="px-3 py-2 text-left">Tezgâh</th>
                <th className="px-3 py-2 text-left">Takım Tutucu</th>
                <th className="px-3 py-2 text-left">Çıkış Nedeni</th>
                <th className="px-3 py-2 text-left">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tools.length === 0 && !loading && <EmptyRow colSpan={9} text="Bu dönemde takım/elmas/uç kullanımı yok" />}
              {tools.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{row.product_name}</div>
                    <div className="text-xs text-slate-500 font-mono-tab">{row.product_code}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">
                    {row.brand || "-"}<span className="text-slate-600"> · </span>{row.category || "-"}<span className="text-slate-600"> · </span>{row.quality || "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tab font-bold text-slate-100">{row.quantity} <span className="text-xs text-slate-500">{row.unit}</span></td>
                  <td className="px-3 py-2 text-slate-300">{row.personnel_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{row.machine_code ? `${row.machine_code} — ` : ""}{row.machine_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{[row.toolholder_code, row.toolholder_name].filter(Boolean).join(" — ") || "-"}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs">{row.exit_reason || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs max-w-[220px] truncate" title={row.note}>{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-bold text-slate-100">Eldiven Kullanımı</div>
          <div className="text-xs text-slate-500">{gloves.length} satır</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Eldiven</th>
                <th className="px-3 py-2 text-left">Beden</th>
                <th className="px-3 py-2 text-left">Marka</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2 text-left">Personel</th>
                <th className="px-3 py-2 text-left">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {gloves.length === 0 && !loading && <EmptyRow colSpan={7} text="Bu dönemde eldiven kullanımı yok" />}
              {gloves.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                  <td className="px-3 py-2 text-slate-100">{row.glove_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.size || "-"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.brand || "-"}</td>
                  <td className="px-3 py-2 text-right font-mono-tab font-bold text-amber-300">{row.quantity}</td>
                  <td className="px-3 py-2 text-slate-300">{row.personnel_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {importOpen && (
        <MovementImport
          mode="personnel"
          title="Personel Sarfiyatı — Excel’den İçe Aktar"
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
