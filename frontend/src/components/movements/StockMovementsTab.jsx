import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { downloadReportWorkbook } from "@/lib/reportExcel";
import MovementImport from "./MovementImport";
import { ActionButtons, DateRangeFields, EmptyRow, Kpi, TotalsCard, formatDay, formatMonth, monthStartISO, todayISO } from "./shared";

const COLUMNS = [
  { header: "Tarih", key: "date", type: "date", width: 12 },
  { header: "Tip", key: "type_label", type: "center", width: 10 },
  { header: "Ürün Kodu", key: "code", width: 16 },
  { header: "Ürün Adı", key: "name", width: 30 },
  { header: "Miktar", key: "quantity", type: "number", width: 10 },
  { header: "Personel", key: "personnel", width: 22 },
  { header: "Tezgâh Kodu", key: "machine_code", width: 12 },
  { header: "Tezgâh", key: "machine", width: 18 },
  { header: "Takım Tutucu", key: "toolholder", width: 20 },
  { header: "Çıkış Nedeni", key: "exit_reason", width: 20 },
  { header: "Tedarikçi", key: "supplier", width: 18 },
  { header: "Not", key: "note", width: 24 },
  { header: "Stok Öncesi", key: "stock_before", type: "number", width: 12 },
  { header: "Stok Sonrası", key: "stock_after", type: "number", width: 12 },
  { header: "Kullanıcı", key: "user", width: 16 },
  { header: "Kaynak", key: "source", width: 14 },
];

export default function StockMovementsTab() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      if (type) params.type = type;
      if (query.trim()) params.q = query.trim();
      const response = await api.get("/reports/stock-movements", { params });
      setData(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Stok hareketleri yüklenemedi");
    }
    setLoading(false);
  }, [from, to, type, query]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const productTotals = data?.product_totals || [];
  const monthly = data?.monthly || [];

  const exportExcel = () => {
    if (!rows.length) return toast.info("Dışa aktarılacak hareket bulunamadı");
    const period = `${from ? formatDay(from) : "başlangıç"} - ${to ? formatDay(to) : "bugün"}`;
    const sheetRows = rows.map((row) => ({
      date: row.date, type_label: row.type_label, code: row.product_code, name: row.product_name,
      quantity: row.quantity, personnel: row.personnel_name, machine_code: row.machine_code,
      machine: row.machine_name, toolholder: [row.toolholder_code, row.toolholder_name].filter(Boolean).join(" — "),
      exit_reason: row.exit_reason, supplier: row.supplier, note: row.note,
      stock_before: row.stock_before ?? "", stock_after: row.stock_after ?? "",
      user: row.user_name, source: row.source === "excel_import" ? "Excel" : "",
    }));
    downloadReportWorkbook({
      filename: `stok-hareketleri-${from || "tum"}-${to || "tum"}.xlsx`,
      sheets: [
        {
          name: "Stok Hareketleri",
          title: "YAZKAN İŞLEME — STOK GİRİŞ / ÇIKIŞ HAREKETLERİ",
          subtitle: `Dönem: ${period} · Tip: ${type === "in" ? "Giriş" : type === "out" ? "Çıkış" : "Tümü"} · ${rows.length} satır`,
          columns: COLUMNS,
          rows: sheetRows,
          footer: { label: "SATIR SAYISI", sumKeys: [] },
        },
        {
          name: "Ürün Toplamları",
          title: "YAZKAN İŞLEME — ÜRÜN BAZINDA STOK TOPLAMI",
          subtitle: `Dönem: ${period} · Tip: ${type === "in" ? "Giriş" : type === "out" ? "Çıkış" : "Tümü"}`,
          columns: [
            { header: "Ürün Kodu", key: "code", width: 16 },
            { header: "Ürün Adı", key: "name", width: 32 },
            { header: "Birim", key: "unit", width: 8 },
            { header: "Giriş", key: "in_quantity", type: "number", width: 12 },
            { header: "Çıkış", key: "out_quantity", type: "number", width: 12 },
            { header: "Net", key: "net", type: "number", width: 12 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: productTotals.map((row) => ({
            code: row.code, name: row.name, unit: row.unit,
            in_quantity: row.in_quantity, out_quantity: row.out_quantity, net: row.net, line_count: row.line_count,
          })),
          footer: { label: "TOPLAM", sumKeys: ["in_quantity", "out_quantity", "net", "line_count"] },
        },
        {
          name: "Aylık Toplamlar",
          title: "YAZKAN İŞLEME — AYLIK STOK HAREKETİ",
          subtitle: `Dönem: ${period} · Tip: ${type === "in" ? "Giriş" : type === "out" ? "Çıkış" : "Tümü"}`,
          columns: [
            { header: "Ay", key: "month", width: 14 },
            { header: "Giriş", key: "in_quantity", type: "number", width: 12 },
            { header: "Çıkış", key: "out_quantity", type: "number", width: 12 },
            { header: "Net", key: "net", type: "number", width: 12 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: monthly.map((row) => ({
            month: row.month, in_quantity: row.in_quantity, out_quantity: row.out_quantity, net: row.net, line_count: row.line_count,
          })),
          footer: { label: "TOPLAM", sumKeys: ["in_quantity", "out_quantity", "net", "line_count"] },
        },
        {
          name: "Özet",
          title: "YAZKAN İŞLEME — STOK HAREKET ÖZETİ",
          subtitle: `Dönem: ${period}`,
          columns: [
            { header: "Açıklama", key: "label", width: 28 },
            { header: "Miktar", key: "value", type: "number", width: 16 },
          ],
          rows: [
            { label: "Toplam Giriş", value: summary.in_quantity ?? 0 },
            { label: "Toplam Çıkış", value: summary.out_quantity ?? 0 },
            { label: "Net", value: summary.net ?? 0 },
            { label: "Hareket Satırı", value: summary.line_count ?? rows.length },
          ],
        },
      ],
    });
    toast.success("Stok hareketleri Excel'i indirildi");
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tip</label>
          <select value={type} onChange={(event) => setType(event.target.value)} data-testid="sm-type"
            className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 min-w-[140px] text-slate-100">
            <option value="">Tümü</option>
            <option value="in">Giriş</option>
            <option value="out">Çıkış</option>
          </select>
        </div>
        <DateRangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ara</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ürün, personel, tezgâh, not..."
            data-testid="sm-search"
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100" />
        </div>
        <button onClick={() => { setType(""); setQuery(""); setFrom(monthStartISO()); setTo(todayISO()); }}
          className="h-12 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Temizle</button>
        <ActionButtons onExport={exportExcel} onImport={() => setImportOpen(true)} exportDisabled={!rows.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Toplam Giriş" value={summary.in_quantity ?? 0} tone="emerald" />
        <Kpi label="Toplam Çıkış" value={summary.out_quantity ?? 0} tone="amber" />
        <Kpi label="Net" value={summary.net ?? 0} tone={(summary.net ?? 0) < 0 ? "red" : "blue"} />
        <Kpi label="Hareket Satırı" value={summary.line_count ?? 0} />
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="font-bold text-slate-100">Giriş / Çıkış Listesi</div>
          <div className="text-xs text-slate-500">{rows.length} satır</div>
        </div>
        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Tip</th>
                <th className="px-3 py-2 text-left">Ürün</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2 text-left">Personel</th>
                <th className="px-3 py-2 text-left">Tezgâh</th>
                <th className="px-3 py-2 text-left">Neden / Tedarikçi</th>
                <th className="px-3 py-2 text-left">Not</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="px-3 py-2 text-left">Kullanıcı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {rows.length === 0 && !loading && <EmptyRow colSpan={10} text="Seçilen dönemde hareket yok" />}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${row.type === "in" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"}`}>
                      {row.type_label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-100">{row.product_name}</div>
                    <div className="text-xs text-slate-500 font-mono-tab">{row.product_code}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tab font-bold text-slate-100">{row.quantity}</td>
                  <td className="px-3 py-2 text-slate-300">{row.personnel_name || "-"}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{row.machine_code ? `${row.machine_code} — ` : ""}{row.machine_name || "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{row.exit_reason || row.supplier || "-"}{row.exit_reason && row.supplier ? ` · ${row.supplier}` : ""}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate" title={row.note}>{row.note || "-"}</td>
                  <td className="px-3 py-2 text-right font-mono-tab text-xs">
                    {row.stock_after == null ? "-" : (
                      <span className={Number(row.stock_after) < 0 ? "text-red-300 font-bold" : "text-slate-300"}>
                        {row.stock_before != null ? `${row.stock_before} → ` : ""}{row.stock_after}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{row.user_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-2 border-t border-slate-700"><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</div>}
      </div>

      <TotalsCard
        title="Ürün Bazında Toplam"
        hint="Dönem içinde her üründen ne kadar girdi / çıktı"
        columns={[
          { key: "name", header: "Ürün", render: (row) => (<div><div className="text-slate-100 font-medium">{row.name || "-"}</div><div className="text-xs text-slate-500 font-mono-tab">{row.code}</div></div>) },
          { key: "in_quantity", header: "Giriş", align: "right", render: (row) => <span className="text-emerald-300 font-bold">{row.in_quantity}</span> },
          { key: "out_quantity", header: "Çıkış", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.out_quantity}</span> },
          { key: "net", header: "Net", align: "right", render: (row) => <span className={row.net < 0 ? "text-red-300 font-bold" : "text-slate-200"}>{row.net}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={productTotals}
      />

      <TotalsCard
        title="Aylık Toplam"
        hint="Ay ay giriş / çıkış"
        columns={[
          { key: "month", header: "Ay", render: (row) => <span className="text-slate-100">{formatMonth(row.month)}</span> },
          { key: "in_quantity", header: "Giriş", align: "right", render: (row) => <span className="text-emerald-300 font-bold">{row.in_quantity}</span> },
          { key: "out_quantity", header: "Çıkış", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.out_quantity}</span> },
          { key: "net", header: "Net", align: "right", render: (row) => <span className={row.net < 0 ? "text-red-300 font-bold" : "text-slate-200"}>{row.net}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={monthly}
      />

      {importOpen && (
        <MovementImport
          mode="stock"
          title="Stok Hareketleri — Excel’den İçe Aktar"
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
