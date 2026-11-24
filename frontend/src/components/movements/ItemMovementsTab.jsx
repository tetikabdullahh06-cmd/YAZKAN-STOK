import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Boxes, Loader2, Wrench } from "lucide-react";
import { downloadReportWorkbook } from "@/lib/reportExcel";
import MovementImport from "./MovementImport";
import { ActionButtons, DateRangeFields, EmptyRow, Kpi, TotalsCard, formatDay, formatMonth, monthStartISO, todayISO } from "./shared";

const COLUMNS = [
  { header: "Tarih", key: "date", type: "date", width: 12 },
  { header: "Tip", key: "type_label", type: "center", width: 10 },
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
];

export default function ItemMovementsTab() {
  const [mode, setMode] = useState("product");
  const [products, setProducts] = useState([]);
  const [toolholders, setToolholders] = useState([]);
  const [productId, setProductId] = useState("");
  const [toolholderId, setToolholderId] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/toolholders").then((r) => setToolholders(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const id = mode === "product" ? productId : toolholderId;
    if (!id) { setData(null); return; }
    setLoading(true);
    try {
      const params = mode === "product" ? { product_id: id } : { toolholder_id: id };
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const response = await api.get("/reports/item-movements", { params });
      setData(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Hareket detayı yüklenemedi");
    }
    setLoading(false);
  }, [mode, productId, toolholderId, from, to]);

  useEffect(() => { load(); }, [load]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setData(null);
    setQuery("");
  };

  const search = query.trim().toLowerCase();
  const filteredProducts = products.filter((product) => !search
    || [product.code, product.name, product.brand, product.quality, product.category]
      .some((value) => String(value || "").toLowerCase().includes(search)));
  const filteredToolholders = toolholders.filter((holder) => !search
    || [holder.code, holder.name, holder.brand, holder.type]
      .some((value) => String(value || "").toLowerCase().includes(search)));

  const item = data?.item;
  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const monthly = data?.monthly || [];
  const personnelTotals = data?.personnel_totals || [];

  const exportExcel = () => {
    if (!item) return toast.info("Önce ürün veya takım tutucu seçin");
    if (!rows.length) return toast.info("Seçilen aralıkta hareket bulunamadı");
    const period = `${from ? formatDay(from) : "başlangıç"} - ${to ? formatDay(to) : "bugün"}`;
    const itemLabel = [item.code, item.name].filter(Boolean).join(" — ");
    const sheetRows = rows.map((row) => ({
      date: row.date, type_label: row.type_label, quantity: row.quantity,
      personnel: row.personnel_name, machine_code: row.machine_code, machine: row.machine_name,
      toolholder: [row.toolholder_code, row.toolholder_name].filter(Boolean).join(" — "),
      exit_reason: row.exit_reason, supplier: row.supplier, note: row.note,
      stock_before: row.stock_before ?? "", stock_after: row.stock_after ?? "", user: row.user_name,
    }));
    downloadReportWorkbook({
      filename: `${mode === "product" ? "urun" : "tutucu"}-hareketleri-${(item.code || item.name || "kayit").toString().replace(/[^\w.-]+/g, "_")}-${from || "tum"}-${to || "tum"}.xlsx`,
      sheets: [
        {
          name: mode === "product" ? "Ürün Hareketleri" : "Tutucu Hareketleri",
          title: mode === "product" ? "YAZKAN İŞLEME — ÜRÜN STOK HAREKETLERİ" : "YAZKAN İŞLEME — TAKIM TUTUCU HAREKETLERİ",
          subtitle: `${itemLabel} · Dönem: ${period} · Mevcut stok: ${item.current_stock} ${item.unit || ""}`,
          columns: COLUMNS,
          rows: sheetRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
        {
          name: "Aylık Toplamlar",
          title: mode === "product" ? "YAZKAN İŞLEME — AYLIK ÜRÜN HAREKETİ" : "YAZKAN İŞLEME — AYLIK TUTUCU HAREKETİ",
          subtitle: `${itemLabel} · Dönem: ${period}`,
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
          name: "Personel Toplamları",
          title: "YAZKAN İŞLEME — PERSONEL BAZINDA HAREKET",
          subtitle: `${itemLabel} · Dönem: ${period}`,
          columns: [
            { header: "Personel", key: "personnel", width: 28 },
            { header: "Giriş", key: "in_quantity", type: "number", width: 12 },
            { header: "Çıkış", key: "out_quantity", type: "number", width: 12 },
            { header: "Net", key: "net", type: "number", width: 12 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: personnelTotals.map((row) => ({
            personnel: row.personnel_name, in_quantity: row.in_quantity, out_quantity: row.out_quantity, net: row.net, line_count: row.line_count,
          })),
          footer: { label: "TOPLAM", sumKeys: ["in_quantity", "out_quantity", "net", "line_count"] },
        },
        {
          name: "Özet",
          title: mode === "product" ? "YAZKAN İŞLEME — ÜRÜN HAREKET ÖZETİ" : "YAZKAN İŞLEME — TUTUCU HAREKET ÖZETİ",
          subtitle: `${itemLabel} · Dönem: ${period}`,
          columns: [
            { header: "Açıklama", key: "label", width: 28 },
            { header: "Değer", key: "value", width: 20 },
          ],
          rows: [
            { label: "Kod", value: item.code || "-" },
            { label: "Ad", value: item.name || "-" },
            { label: "Marka", value: item.brand || "-" },
            { label: mode === "product" ? "Kategori" : "Tip", value: item.category || "-" },
            { label: "Kalite", value: item.quality || "-" },
            { label: "Mevcut Stok", value: item.current_stock ?? 0 },
            { label: "Toplam Giriş", value: summary.in_quantity ?? 0 },
            { label: "Toplam Çıkış", value: summary.out_quantity ?? 0 },
            { label: "Net", value: summary.net ?? 0 },
            { label: "Hareket Satırı", value: summary.line_count ?? 0 },
          ],
        },
      ],
    });
    toast.success("Hareket Excel'i indirildi");
  };

  const reset = () => {
    setQuery("");
    if (mode === "product") setProductId(""); else setToolholderId("");
    setFrom(monthStartISO());
    setTo(todayISO());
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          <button onClick={() => switchMode("product")}
            className={`h-11 px-4 rounded-lg font-bold inline-flex items-center gap-2 border ${mode === "product" ? "bg-red-600 border-red-500 text-white" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
            <Boxes className="w-4 h-4" /> Ürün
          </button>
          <button onClick={() => switchMode("toolholder")}
            className={`h-11 px-4 rounded-lg font-bold inline-flex items-center gap-2 border ${mode === "toolholder" ? "bg-red-600 border-red-500 text-white" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
            <Wrench className="w-4 h-4" /> Takım Tutucu
          </button>
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ara</label>
            <input value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === "product" ? "Kod, ürün adı, marka, kategori, kalite..." : "Kod, tutucu adı, marka..."}
              data-testid="im-search"
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100" />
          </div>
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              {mode === "product" ? "Ürün" : "Takım Tutucu"}
            </label>
            {mode === "product" ? (
              <select value={productId} onChange={(event) => setProductId(event.target.value)} data-testid="im-product"
                className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100">
                <option value="">-- Ürün seçin --</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} — {product.name} | Marka: {product.brand || "-"} | Kategori: {product.category || "-"} | Kalite: {product.quality || "-"} | Stok: {product.current_stock}
                  </option>
                ))}
              </select>
            ) : (
              <select value={toolholderId} onChange={(event) => setToolholderId(event.target.value)} data-testid="im-toolholder"
                className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100">
                <option value="">-- Takım tutucu seçin --</option>
                {filteredToolholders.map((holder) => (
                  <option key={holder.id} value={holder.id}>
                    {holder.code ? `${holder.code} — ` : ""}{holder.name} | Marka: {holder.brand || "-"} | Stok: {holder.current_stock ?? 0}
                  </option>
                ))}
              </select>
            )}
          </div>
          <DateRangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
          <button onClick={reset} className="h-12 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Temizle</button>
          <ActionButtons onExport={exportExcel} onImport={() => setImportOpen(true)} exportDisabled={!rows.length} />
        </div>
      </div>

      {!item && !loading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center text-slate-400">
          Hareketlerini görmek için bir {mode === "product" ? "ürün" : "takım tutucu"} seçin.
        </div>
      )}

      {loading && <div className="text-center py-6 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...</div>}

      {item && (
        <>
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div><span className="text-slate-500">Kod:</span> <span className="font-mono-tab text-slate-100">{item.code || "-"}</span></div>
            <div><span className="text-slate-500">Ad:</span> <span className="font-semibold text-slate-100">{item.name}</span></div>
            <div><span className="text-slate-500">Marka:</span> <span className="text-slate-200">{item.brand || "-"}</span></div>
            <div><span className="text-slate-500">{mode === "product" ? "Kategori" : "Tip"}:</span> <span className="text-slate-200">{item.category || "-"}</span></div>
            {mode === "product" && <div><span className="text-slate-500">Kalite:</span> <span className="text-slate-200">{item.quality || "-"}</span></div>}
            {mode === "toolholder" && item.length && <div><span className="text-slate-500">Boy:</span> <span className="text-slate-200">{item.length}</span></div>}
            {mode === "toolholder" && item.diameter && <div><span className="text-slate-500">Çap:</span> <span className="text-slate-200">{item.diameter}</span></div>}
            <div><span className="text-slate-500">Mevcut Stok:</span> <span className={`font-bold font-mono-tab ${Number(item.current_stock) < 0 ? "text-red-300" : "text-emerald-300"}`}>{item.current_stock} {item.unit || ""}</span></div>
            <div><span className="text-slate-500">Min. Stok:</span> <span className="font-mono-tab text-slate-200">{item.min_stock ?? 0}</span></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Toplam Giriş" value={summary.in_quantity ?? 0} tone="emerald" />
            <Kpi label="Toplam Çıkış" value={summary.out_quantity ?? 0} tone="amber" />
            <Kpi label="Net" value={summary.net ?? 0} tone={(summary.net ?? 0) < 0 ? "red" : "blue"} />
            <Kpi label="Hareket Satırı" value={summary.line_count ?? 0} />
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="font-bold text-slate-100">{formatDay(from)} – {formatDay(to)} hareketleri</div>
              <div className="text-xs text-slate-500">{rows.length} satır</div>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left">Tarih</th>
                    <th className="px-3 py-2 text-left">Tip</th>
                    <th className="px-3 py-2 text-right">Miktar</th>
                    <th className="px-3 py-2 text-left">Personel</th>
                    <th className="px-3 py-2 text-left">Tezgâh</th>
                    {mode === "product" && <th className="px-3 py-2 text-left">Takım Tutucu</th>}
                    <th className="px-3 py-2 text-left">Neden / Tedarikçi</th>
                    <th className="px-3 py-2 text-left">Not</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-left">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {rows.length === 0 && <EmptyRow colSpan={mode === "product" ? 10 : 9} text="Seçilen tarih aralığında hareket yok" />}
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-700/40">
                      <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${row.type === "in" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"}`}>
                          {row.type_label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono-tab font-bold text-slate-100">{row.quantity}</td>
                      <td className="px-3 py-2 text-slate-300">{row.personnel_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs">{row.machine_code ? `${row.machine_code} — ` : ""}{row.machine_name || "-"}</td>
                      {mode === "product" && <td className="px-3 py-2 text-slate-400 text-xs">{[row.toolholder_code, row.toolholder_name].filter(Boolean).join(" — ") || "-"}</td>}
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
          </div>
        </>
      )}

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

      <TotalsCard
        title="Personel Bazında Toplam"
        hint={mode === "product" ? "Bu üründen kim ne kadar kullandı" : "Bu tutucuyu kim ne kadar kullandı"}
        columns={[
          { key: "personnel_name", header: "Personel", render: (row) => <span className="text-slate-100">{row.personnel_name}</span> },
          { key: "in_quantity", header: "Giriş", align: "right", render: (row) => <span className="text-emerald-300 font-bold">{row.in_quantity}</span> },
          { key: "out_quantity", header: "Çıkış", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.out_quantity}</span> },
          { key: "net", header: "Net", align: "right", render: (row) => <span className={row.net < 0 ? "text-red-300 font-bold" : "text-slate-200"}>{row.net}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={personnelTotals}
      />

      {importOpen && (
        <MovementImport
          mode={mode}
          title={mode === "product" ? "Ürün Hareketleri — Excel’den İçe Aktar" : "Takım Tutucu Hareketleri — Excel’den İçe Aktar"}
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
