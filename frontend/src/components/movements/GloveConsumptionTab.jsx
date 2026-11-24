import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { downloadReportWorkbook } from "@/lib/reportExcel";
import MovementImport from "./MovementImport";
import { ActionButtons, DateRangeFields, EmptyRow, Kpi, TotalsCard, formatDay, formatMonth, monthStartISO, todayISO } from "./shared";

const DETAIL_COLUMNS = [
  { header: "Tarih", key: "date", type: "date", width: 12 },
  { header: "Eldiven", key: "glove", width: 26 },
  { header: "Beden", key: "size", width: 10 },
  { header: "Marka", key: "brand", width: 16 },
  { header: "Miktar", key: "quantity", type: "number", width: 10 },
  { header: "Personel", key: "personnel", width: 22 },
  { header: "Not", key: "note", width: 26 },
  { header: "Kullanıcı", key: "user", width: 16 },
];

export default function GloveConsumptionTab() {
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
      const params = { scope: "gloves" };
      if (personnelId) params.personnel_id = personnelId;
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const response = await api.get("/reports/personnel-consumption", { params });
      setData(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Eldiven sarfiyat listesi yüklenemedi");
    }
    setLoading(false);
  }, [personnelId, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/personnel").then((r) => setPersonnel(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const selectedPerson = personnel.find((person) => person.id === personnelId);
  const selectedName = selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : "Tüm personel";
  const summary = data?.summary || {};
  const gloves = data?.gloves || [];
  const gloveTotals = data?.glove_totals || [];
  const monthly = data?.monthly || [];

  const personnelTotals = useMemo(() => {
    const map = new Map();
    (data?.gloves || []).forEach((row) => {
      const key = row.personnel_name || "Belirtilmemiş";
      const item = map.get(key) || { personnel_name: key, quantity: 0, line_count: 0 };
      item.quantity = Math.round((item.quantity + Number(row.quantity || 0)) * 1000) / 1000;
      item.line_count += 1;
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => b.quantity - a.quantity);
  }, [data]);

  const exportExcel = () => {
    if (!gloves.length) return toast.info("Dışa aktarılacak eldiven sarfiyatı bulunamadı");
    const period = `${from ? formatDay(from) : "başlangıç"} - ${to ? formatDay(to) : "bugün"}`;
    const detailRows = gloves.map((row) => ({
      date: row.date, glove: row.glove_name, size: row.size, brand: row.brand,
      quantity: row.quantity, personnel: row.personnel_name, note: row.note, user: row.user_name,
    }));
    const totalRows = gloveTotals.map((row) => ({
      glove: row.name, size: row.size, brand: row.brand, quantity: row.quantity,
      line_count: row.line_count, first_date: row.first_date, last_date: row.last_date,
    }));
    const monthlyRows = monthly.map((row) => ({ month: row.month, quantity: row.glove_quantity, line_count: row.line_count }));
    const personRows = personnelTotals.map((row) => ({ personnel: row.personnel_name, quantity: row.quantity, line_count: row.line_count }));

    downloadReportWorkbook({
      filename: `eldiven-sarfiyat-${from || "tum"}-${to || "tum"}.xlsx`,
      sheets: [
        {
          name: "Eldiven Sarfiyatı",
          title: "YAZKAN İŞLEME — PERSONEL ELDİVEN SARFİYATI",
          subtitle: `Personel: ${selectedName} · Dönem: ${period}`,
          columns: DETAIL_COLUMNS,
          rows: detailRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
        {
          name: "Eldiven Toplamları",
          title: "YAZKAN İŞLEME — ELDİVEN BAZINDA TOPLAM",
          subtitle: `Personel: ${selectedName} · Dönem: ${period}`,
          columns: [
            { header: "Eldiven", key: "glove", width: 26 },
            { header: "Beden", key: "size", width: 10 },
            { header: "Marka", key: "brand", width: 16 },
            { header: "Toplam Miktar", key: "quantity", type: "number", width: 14 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
            { header: "İlk Tarih", key: "first_date", type: "date", width: 12 },
            { header: "Son Tarih", key: "last_date", type: "date", width: 12 },
          ],
          rows: totalRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
        {
          name: "Aylık Toplamlar",
          title: "YAZKAN İŞLEME — AYLIK ELDİVEN SARFİYATI",
          subtitle: `Personel: ${selectedName} · Dönem: ${period}`,
          columns: [
            { header: "Ay", key: "month", width: 14 },
            { header: "Eldiven Miktarı", key: "quantity", type: "number", width: 16 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: monthlyRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
        {
          name: "Personel Toplamları",
          title: "YAZKAN İŞLEME — PERSONEL BAZINDA ELDİVEN",
          subtitle: `Dönem: ${period}`,
          columns: [
            { header: "Personel", key: "personnel", width: 28 },
            { header: "Toplam Miktar", key: "quantity", type: "number", width: 14 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: personRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
      ],
    });
    toast.success("Eldiven sarfiyat Excel'i indirildi");
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Personel</label>
          <select value={personnelId} onChange={(event) => setPersonnelId(event.target.value)} data-testid="gc-personnel"
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
        <ActionButtons onExport={exportExcel} onImport={() => setImportOpen(true)} exportDisabled={!gloves.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Toplam Eldiven" value={summary.glove_quantity ?? 0} tone="amber" suffix="çift" />
        <Kpi label="Kayıt Satırı" value={summary.glove_lines ?? 0} />
        <Kpi label="Eldiven Çeşidi" value={summary.glove_items ?? 0} tone="blue" />
        <Kpi label="Personel" value={summary.personnel_count ?? 0} tone="emerald" />
      </div>

      {loading && <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...</div>}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-bold text-slate-100">Eldiven Kullanım Detayı</div>
          <div className="text-xs text-slate-500">{gloves.length} satır · {selectedName}</div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Eldiven</th>
                <th className="px-3 py-2 text-left">Beden</th>
                <th className="px-3 py-2 text-left">Marka</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2 text-left">Personel</th>
                <th className="px-3 py-2 text-left">Not</th>
                <th className="px-3 py-2 text-left">Kullanıcı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {gloves.length === 0 && !loading && <EmptyRow colSpan={8} text="Bu dönemde eldiven kullanımı yok" />}
              {gloves.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                  <td className="px-3 py-2 text-slate-100">{row.glove_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.size || "-"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.brand || "-"}</td>
                  <td className="px-3 py-2 text-right font-mono-tab font-bold text-amber-300">{row.quantity}</td>
                  <td className="px-3 py-2 text-slate-300">{row.personnel_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{row.note || "-"}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{row.user_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TotalsCard
        title="Eldiven Bazında Toplam"
        hint="Seçilen dönemde hangi eldivenden kaç çift kullanıldı"
        columns={[
          { key: "name", header: "Eldiven", render: (row) => <span className="text-slate-100">{row.name || "-"}</span> },
          { key: "size", header: "Beden", render: (row) => row.size || "-" },
          { key: "brand", header: "Marka", render: (row) => row.brand || "-" },
          { key: "quantity", header: "Toplam", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
          { key: "range", header: "İlk – Son", render: (row) => `${formatDay(row.first_date)} – ${formatDay(row.last_date)}` },
        ]}
        rows={gloveTotals}
      />

      <TotalsCard
        title="Aylık Toplam"
        hint="Ay ay eldiven kullanımı"
        columns={[
          { key: "month", header: "Ay", render: (row) => <span className="text-slate-100">{formatMonth(row.month)}</span> },
          { key: "glove_quantity", header: "Eldiven", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.glove_quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={monthly}
      />

      <TotalsCard
        title="Personel Bazında Toplam"
        hint="Kim kaç çift eldiven kullandı"
        columns={[
          { key: "personnel_name", header: "Personel", render: (row) => <span className="text-slate-100">{row.personnel_name}</span> },
          { key: "quantity", header: "Toplam", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={personnelTotals}
      />

      {importOpen && (
        <MovementImport
          mode="glove"
          title="Eldiven Sarfiyatı — Excel’den İçe Aktar"
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
