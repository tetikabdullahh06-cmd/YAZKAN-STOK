import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { downloadReportWorkbook } from "@/lib/reportExcel";
import { ActionButtons, DateRangeFields, EmptyRow, Kpi, TotalsCard, formatDay, formatMonth, monthStartISO, todayISO } from "./shared";

const round3 = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const monthOf = (row) => String(row.date || "").slice(0, 7);
const monthTitle = (month) => (month ? formatMonth(month) : "Tüm dönem");

const buildMonths = (tools, gloves) => {
  const map = new Map();
  const bucket = (month) => {
    if (!map.has(month)) map.set(month, { month, tool_quantity: 0, glove_quantity: 0, tool_lines: 0, glove_lines: 0, line_count: 0 });
    return map.get(month);
  };
  tools.forEach((row) => {
    const month = monthOf(row);
    if (!month) return;
    const item = bucket(month);
    item.tool_quantity = round3(item.tool_quantity + Number(row.quantity || 0));
    item.tool_lines += 1;
    item.line_count += 1;
  });
  gloves.forEach((row) => {
    const month = monthOf(row);
    if (!month) return;
    const item = bucket(month);
    item.glove_quantity = round3(item.glove_quantity + Number(row.quantity || 0));
    item.glove_lines += 1;
    item.line_count += 1;
  });
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
};

const buildProductTotals = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.product_id || row.product_code || row.product_name;
    if (!key) return;
    const item = map.get(key) || {
      key,
      code: row.product_code || "-",
      name: row.product_name || "-",
      brand: row.brand || "-",
      category: row.category || "-",
      quality: row.quality || "-",
      unit: row.unit || "adet",
      current_stock: Number(row.current_stock ?? 0),
      min_stock: Number(row.min_stock ?? 0),
      quantity: 0,
      line_count: 0,
      first_date: row.date,
      last_date: row.date,
    };
    item.quantity = round3(item.quantity + Number(row.quantity || 0));
    item.line_count += 1;
    if (row.date && (!item.first_date || row.date < item.first_date)) item.first_date = row.date;
    if (row.date && row.date > item.last_date) item.last_date = row.date;
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || String(a.name).localeCompare(String(b.name), "tr"));
};

const buildGloveTotals = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.glove_id || `${row.glove_name || "-"}|${row.size || ""}`;
    const item = map.get(key) || {
      key,
      name: row.glove_name || "-",
      size: row.size || "-",
      brand: row.brand || "-",
      unit: row.unit || "çift",
      current_stock: Number(row.current_stock ?? 0),
      min_stock: Number(row.min_stock ?? 0),
      quantity: 0,
      line_count: 0,
      first_date: row.date,
      last_date: row.date,
    };
    item.quantity = round3(item.quantity + Number(row.quantity || 0));
    item.line_count += 1;
    if (row.date && (!item.first_date || row.date < item.first_date)) item.first_date = row.date;
    if (row.date && row.date > item.last_date) item.last_date = row.date;
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || String(a.name).localeCompare(String(b.name), "tr"));
};

const buildPersonnelTotals = (tools, gloves) => {
  const map = new Map();
  const bucket = (row) => {
    const key = row.personnel_id || row.personnel_name || "-";
    if (!map.has(key)) {
      map.set(key, {
        key,
        personnel_name: row.personnel_name || "Bilinmeyen",
        tool_quantity: 0,
        glove_quantity: 0,
        line_count: 0,
      });
    }
    return map.get(key);
  };
  tools.forEach((row) => {
    const item = bucket(row);
    item.tool_quantity = round3(item.tool_quantity + Number(row.quantity || 0));
    item.line_count += 1;
  });
  gloves.forEach((row) => {
    const item = bucket(row);
    item.glove_quantity = round3(item.glove_quantity + Number(row.quantity || 0));
    item.line_count += 1;
  });
  return [...map.values()].sort((a, b) => String(a.personnel_name).localeCompare(String(b.personnel_name), "tr"));
};

export default function TotalsTab() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const response = await api.get("/reports/personnel-consumption", { params });
      setData(response.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Sarfiyat toplamları yüklenemedi");
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const tools = useMemo(() => data?.tools || [], [data]);
  const gloves = useMemo(() => data?.gloves || [], [data]);
  const months = useMemo(() => buildMonths(tools, gloves), [tools, gloves]);

  useEffect(() => {
    if (month && !months.some((item) => item.month === month)) setMonth("");
  }, [month, months]);

  const scopedTools = useMemo(() => (month ? tools.filter((row) => monthOf(row) === month) : tools), [tools, month]);
  const scopedGloves = useMemo(() => (month ? gloves.filter((row) => monthOf(row) === month) : gloves), [gloves, month]);

  const productTotals = useMemo(() => buildProductTotals(scopedTools), [scopedTools]);
  const gloveTotals = useMemo(() => buildGloveTotals(scopedGloves), [scopedGloves]);
  const personnelTotals = useMemo(() => buildPersonnelTotals(scopedTools, scopedGloves), [scopedTools, scopedGloves]);

  const toolQuantity = useMemo(() => round3(scopedTools.reduce((sum, row) => sum + Number(row.quantity || 0), 0)), [scopedTools]);
  const gloveQuantity = useMemo(() => round3(scopedGloves.reduce((sum, row) => sum + Number(row.quantity || 0), 0)), [scopedGloves]);

  const allItems = useMemo(() => {
    const rows = [
      ...scopedTools.map((row) => ({
        id: `tool-${row.id}`,
        date: row.date,
        type: "Takım",
        name: row.product_name || row.product_code || "-",
        detail: [row.category, row.quality].filter(Boolean).join(" · ") || "-",
        quantity: row.quantity,
        personnel: row.personnel_name || "-",
      })),
      ...scopedGloves.map((row) => ({
        id: `glove-${row.id}`,
        date: row.date,
        type: "Eldiven",
        name: row.glove_name || "-",
        detail: [row.brand, row.size ? `Beden ${row.size}` : ""].filter(Boolean).join(" · ") || "-",
        quantity: row.quantity,
        personnel: row.personnel_name || "-",
      })),
    ];
    return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [scopedTools, scopedGloves]);

  const visibleItems = allItems.slice(0, 300);
  const scopeLabel = monthTitle(month);

  const exportExcel = () => {
    if (!scopedTools.length && !scopedGloves.length) {
      toast.info("Dışa aktarılacak sarfiyat kaydı bulunamadı");
      return;
    }
    const period = `${from ? formatDay(from) : "başlangıç"} - ${to ? formatDay(to) : "bugün"}`;
    const subtitle = `Dönem: ${period}${month ? ` · Ay: ${formatMonth(month)}` : " · Tüm aylar"}`;

    const monthKeys = month ? [month] : months.map((item) => item.month);
    const summaryRows = [];
    monthKeys.forEach((monthKey) => {
      const monthTools = tools.filter((row) => monthOf(row) === monthKey);
      const monthGloves = gloves.filter((row) => monthOf(row) === monthKey);
      if (!monthTools.length && !monthGloves.length) return;
      const monthToolQty = round3(monthTools.reduce((sum, row) => sum + Number(row.quantity || 0), 0));
      const monthGloveQty = round3(monthGloves.reduce((sum, row) => sum + Number(row.quantity || 0), 0));
      summaryRows.push({
        __band: `${formatMonth(monthKey).toLocaleUpperCase("tr-TR")} — Takım: ${monthToolQty} · Eldiven: ${monthGloveQty} çift · ${monthTools.length + monthGloves.length} kayıt`,
      });
      buildProductTotals(monthTools).forEach((row) => {
        summaryRows.push({
          type: "Takım",
          name: row.name,
          category: row.category,
          quality: row.quality,
          unit: row.unit,
          quantity: row.quantity,
          line_count: row.line_count,
          current_stock: row.current_stock,
        });
      });
      buildGloveTotals(monthGloves).forEach((row) => {
        summaryRows.push({
          type: "Eldiven",
          name: row.name,
          category: row.brand,
          quality: row.size,
          unit: "çift",
          quantity: row.quantity,
          line_count: row.line_count,
          current_stock: row.current_stock,
        });
      });
    });

    const monthlyRows = (month ? months.filter((item) => item.month === month) : months).map((item) => ({
      month: formatMonth(item.month),
      tool_quantity: item.tool_quantity,
      glove_quantity: item.glove_quantity,
      line_count: item.line_count,
    }));

    const productRows = productTotals.map((row) => ({
      code: row.code,
      name: row.name,
      brand: row.brand,
      category: row.category,
      quality: row.quality,
      unit: row.unit,
      quantity: row.quantity,
      line_count: row.line_count,
      first_date: row.first_date,
      last_date: row.last_date,
      current_stock: row.current_stock,
    }));

    const gloveRows = gloveTotals.map((row) => ({
      name: row.name,
      size: row.size,
      brand: row.brand,
      quantity: row.quantity,
      line_count: row.line_count,
      first_date: row.first_date,
      last_date: row.last_date,
      current_stock: row.current_stock,
    }));

    const personnelRows = personnelTotals.map((row) => ({
      personnel: row.personnel_name,
      tool_quantity: row.tool_quantity,
      glove_quantity: row.glove_quantity,
      line_count: row.line_count,
    }));

    const toolDetailRows = [...scopedTools]
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .map((row) => ({
        date: row.date,
        code: row.product_code,
        name: row.product_name,
        category: row.category,
        quality: row.quality,
        quantity: row.quantity,
        personnel: row.personnel_name,
        machine: row.machine_code || row.machine_name,
        toolholder: row.toolholder_code || row.toolholder_name,
        production_product: row.production_product,
        exit_reason: row.exit_reason,
        note: row.note,
      }));

    const gloveDetailRows = [...scopedGloves]
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .map((row) => ({
        date: row.date,
        name: row.glove_name,
        size: row.size,
        brand: row.brand,
        quantity: row.quantity,
        personnel: row.personnel_name,
        note: row.note,
      }));

    downloadReportWorkbook({
      filename: `sarfiyat-toplamlari-${from || "tum"}-${to || "tum"}${month ? `-${month}` : ""}.xlsx`,
      sheets: [
        {
          name: "Aylık Özet",
          title: "YAZKAN İŞLEME — AYLIK SARFİYAT ÖZETİ",
          subtitle,
          columns: [
            { header: "Tür", key: "type", width: 11 },
            { header: "Ürün / Eldiven", key: "name", width: 34 },
            { header: "Kategori / Marka", key: "category", width: 18 },
            { header: "Kalite / Beden", key: "quality", width: 14 },
            { header: "Birim", key: "unit", width: 9 },
            { header: "Miktar", key: "quantity", type: "number", width: 11 },
            { header: "Kayıt", key: "line_count", type: "number", width: 9 },
            { header: "Kalan Stok", key: "current_stock", type: "number", width: 12 },
          ],
          rows: summaryRows,
          footer: { label: "GENEL TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
        {
          name: "Ürün Toplamları",
          title: "YAZKAN İŞLEME — ÜRÜN BAZINDA TOPLAM SARFİYAT",
          subtitle: `${scopeLabel} · Dönem: ${period}`,
          columns: [
            { header: "Ürün Kodu", key: "code", width: 14 },
            { header: "Ürün Adı", key: "name", width: 32 },
            { header: "Marka", key: "brand", width: 16 },
            { header: "Kategori", key: "category", width: 16 },
            { header: "Kalite", key: "quality", width: 12 },
            { header: "Birim", key: "unit", width: 9 },
            { header: "Toplam Miktar", key: "quantity", type: "number", width: 13 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
            { header: "İlk Tarih", key: "first_date", type: "date", width: 12 },
            { header: "Son Tarih", key: "last_date", type: "date", width: 12 },
            { header: "Kalan Stok", key: "current_stock", type: "number", width: 12 },
          ],
          rows: productRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
        {
          name: "Eldiven Toplamları",
          title: "YAZKAN İŞLEME — ELDİVEN BAZINDA TOPLAM SARFİYAT",
          subtitle: `${scopeLabel} · Dönem: ${period}`,
          columns: [
            { header: "Eldiven", key: "name", width: 28 },
            { header: "Beden", key: "size", width: 10 },
            { header: "Marka", key: "brand", width: 16 },
            { header: "Toplam Miktar", key: "quantity", type: "number", width: 13 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
            { header: "İlk Tarih", key: "first_date", type: "date", width: 12 },
            { header: "Son Tarih", key: "last_date", type: "date", width: 12 },
            { header: "Kalan Stok", key: "current_stock", type: "number", width: 12 },
          ],
          rows: gloveRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity", "line_count"] },
        },
        {
          name: "Aylık Toplamlar",
          title: "YAZKAN İŞLEME — AYLIK SARFİYAT TOPLAMI",
          subtitle: `Dönem: ${period}`,
          columns: [
            { header: "Ay", key: "month", width: 16 },
            { header: "Takım Sarfiyatı", key: "tool_quantity", type: "number", width: 16 },
            { header: "Eldiven Sarfiyatı", key: "glove_quantity", type: "number", width: 17 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: monthlyRows,
          footer: { label: "TOPLAM", sumKeys: ["tool_quantity", "glove_quantity", "line_count"] },
        },
        {
          name: "Personel Toplamları",
          title: "YAZKAN İŞLEME — PERSONEL BAZINDA TOPLAM SARFİYAT",
          subtitle: `${scopeLabel} · Dönem: ${period}`,
          columns: [
            { header: "Personel", key: "personnel", width: 30 },
            { header: "Takım Miktarı", key: "tool_quantity", type: "number", width: 15 },
            { header: "Eldiven Miktarı", key: "glove_quantity", type: "number", width: 16 },
            { header: "Kayıt Sayısı", key: "line_count", type: "number", width: 12 },
          ],
          rows: personnelRows,
          footer: { label: "TOPLAM", sumKeys: ["tool_quantity", "glove_quantity", "line_count"] },
        },
        {
          name: "Ürün Detayları",
          title: "YAZKAN İŞLEME — TAKIM SARFİYAT DETAYI",
          subtitle: `${scopeLabel} · Dönem: ${period}`,
          columns: [
            { header: "Tarih", key: "date", type: "date", width: 12 },
            { header: "Ürün Kodu", key: "code", width: 13 },
            { header: "Ürün Adı", key: "name", width: 30 },
            { header: "Kategori", key: "category", width: 14 },
            { header: "Kalite", key: "quality", width: 11 },
            { header: "Miktar", key: "quantity", type: "number", width: 10 },
            { header: "Personel", key: "personnel", width: 22 },
            { header: "Tezgah", key: "machine", width: 14 },
            { header: "Takım Tutucu", key: "toolholder", width: 14 },
            { header: "Üretilen Ürün", key: "production_product", width: 20 },
            { header: "Çıkış Nedeni", key: "exit_reason", width: 20 },
            { header: "Not", key: "note", width: 24 },
          ],
          rows: toolDetailRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
        {
          name: "Eldiven Detayları",
          title: "YAZKAN İŞLEME — ELDİVEN SARFİYAT DETAYI",
          subtitle: `${scopeLabel} · Dönem: ${period}`,
          columns: [
            { header: "Tarih", key: "date", type: "date", width: 12 },
            { header: "Eldiven", key: "name", width: 28 },
            { header: "Beden", key: "size", width: 10 },
            { header: "Marka", key: "brand", width: 16 },
            { header: "Miktar", key: "quantity", type: "number", width: 10 },
            { header: "Personel", key: "personnel", width: 24 },
            { header: "Not", key: "note", width: 26 },
          ],
          rows: gloveDetailRows,
          footer: { label: "TOPLAM", sumKeys: ["quantity"] },
        },
      ],
    });
    toast.success("Toplamlar Excel'i indirildi (7 sayfa)");
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 flex-wrap items-end">
        <DateRangeFields from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <button onClick={() => { setFrom(monthStartISO()); setTo(todayISO()); setMonth(""); }}
          className="h-12 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">Temizle</button>
        <ActionButtons onExport={exportExcel} exportDisabled={!scopedTools.length && !scopedGloves.length} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Takım Sarfiyatı" value={toolQuantity} tone="blue" suffix="adet" />
        <Kpi label="Eldiven Sarfiyatı" value={gloveQuantity} tone="amber" suffix="çift" />
        <Kpi label="Kalem Çeşidi" value={productTotals.length + gloveTotals.length} />
        <Kpi label="Personel" value={personnelTotals.length} tone="emerald" />
      </div>

      {loading && <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor...</div>}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-slate-100">Ay Bazında Özet</div>
            <div className="text-xs text-slate-500">Bir aya tıklayın; aşağıdaki tüm toplamlar ve Excel o aya göre hazırlanır</div>
          </div>
          <select value={month} onChange={(event) => setMonth(event.target.value)} data-testid="totals-month"
            className="h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-slate-100">
            <option value="">Tüm dönem</option>
            {months.map((item) => (
              <option key={item.month} value={item.month}>{formatMonth(item.month)}</option>
            ))}
          </select>
        </div>
        <div className="overflow-auto max-h-[45vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Ay</th>
                <th className="px-3 py-2 text-right">Takım</th>
                <th className="px-3 py-2 text-right">Eldiven</th>
                <th className="px-3 py-2 text-right">Kayıt</th>
                <th className="px-3 py-2 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {months.length === 0 && !loading && <EmptyRow colSpan={5} text="Bu dönemde sarfiyat kaydı yok" />}
              {months.map((row) => {
                const active = month === row.month;
                return (
                  <tr key={row.month} onClick={() => setMonth(active ? "" : row.month)}
                    className={`cursor-pointer ${active ? "bg-red-950/40" : "hover:bg-slate-700/40"}`}>
                    <td className="px-3 py-2 text-slate-100 font-semibold">{formatMonth(row.month)}</td>
                    <td className="px-3 py-2 text-right font-mono-tab text-blue-300">{row.tool_quantity}</td>
                    <td className="px-3 py-2 text-right font-mono-tab text-amber-300">{row.glove_quantity}</td>
                    <td className="px-3 py-2 text-right font-mono-tab text-slate-400">{row.line_count}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {active ? <span className="text-red-400 font-bold">Seçili</span> : <span className="text-slate-500">Seç</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {months.length > 0 && (
              <tfoot className="bg-slate-900/60 font-bold">
                <tr>
                  <td className="px-3 py-2 text-slate-200">TOPLAM · {scopeLabel}</td>
                  <td className="px-3 py-2 text-right font-mono-tab text-blue-300">{toolQuantity}</td>
                  <td className="px-3 py-2 text-right font-mono-tab text-amber-300">{gloveQuantity}</td>
                  <td className="px-3 py-2 text-right font-mono-tab text-slate-300">{scopedTools.length + scopedGloves.length}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <TotalsCard
        title="Ürün Bazında Toplam"
        hint={`${scopeLabel} · hangi üründen ne kadar kullanıldı · kalan stok güncel değerdir`}
        columns={[
          { key: "code", header: "Kod", render: (row) => <span className="text-slate-400">{row.code}</span> },
          { key: "name", header: "Ürün", render: (row) => <span className="text-slate-100">{row.name}</span> },
          { key: "category", header: "Kategori", render: (row) => row.category || "-" },
          { key: "quality", header: "Kalite", render: (row) => row.quality || "-" },
          { key: "unit", header: "Birim", render: (row) => row.unit || "adet" },
          { key: "quantity", header: "Toplam", align: "right", render: (row) => <span className="text-blue-300 font-bold">{row.quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
          {
            key: "current_stock",
            header: "Kalan Stok",
            align: "right",
            render: (row) => (
              <span className={`font-bold ${Number(row.current_stock) <= Number(row.min_stock || 0) ? "text-red-400" : "text-emerald-300"}`}>
                {row.current_stock} <span className="text-xs opacity-70">{row.unit || "adet"}</span>
              </span>
            ),
          },
        ]}
        rows={productTotals}
      />

      <TotalsCard
        title="Eldiven Bazında Toplam"
        hint={`${scopeLabel} · hangi eldivenden ne kadar kullanıldı · kalan stok güncel değerdir`}
        columns={[
          { key: "name", header: "Eldiven", render: (row) => <span className="text-slate-100">{row.name}</span> },
          { key: "size", header: "Beden", render: (row) => row.size || "-" },
          { key: "brand", header: "Marka", render: (row) => row.brand || "-" },
          { key: "quantity", header: "Toplam", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
          {
            key: "current_stock",
            header: "Kalan Stok",
            align: "right",
            render: (row) => (
              <span className={`font-bold ${Number(row.current_stock) <= Number(row.min_stock || 0) ? "text-red-400" : "text-emerald-300"}`}>
                {row.current_stock} <span className="text-xs opacity-70">{row.unit || "çift"}</span>
              </span>
            ),
          },
        ]}
        rows={gloveTotals}
      />

      <TotalsCard
        title="Personel Bazında Toplam"
        hint={`${scopeLabel} · kim ne kadar kullandı`}
        columns={[
          { key: "personnel_name", header: "Personel", render: (row) => <span className="text-slate-100">{row.personnel_name}</span> },
          { key: "tool_quantity", header: "Takım", align: "right", render: (row) => <span className="text-blue-300 font-bold">{row.tool_quantity}</span> },
          { key: "glove_quantity", header: "Eldiven", align: "right", render: (row) => <span className="text-amber-300 font-bold">{row.glove_quantity}</span> },
          { key: "line_count", header: "Kayıt", align: "right" },
        ]}
        rows={personnelTotals}
      />

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-bold text-slate-100">Tüm Sarfiyat Kalemleri</div>
          <div className="text-xs text-slate-500">
            {allItems.length} satır · {scopeLabel}{allItems.length > visibleItems.length ? ` · ilk ${visibleItems.length} satır gösteriliyor` : ""}
          </div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase tracking-wider text-xs sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-left">Tür</th>
                <th className="px-3 py-2 text-left">Kalem</th>
                <th className="px-3 py-2 text-left">Kategori / Marka</th>
                <th className="px-3 py-2 text-right">Miktar</th>
                <th className="px-3 py-2 text-left">Personel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {visibleItems.length === 0 && !loading && <EmptyRow colSpan={6} text="Kayıt yok" />}
              {visibleItems.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/40">
                  <td className="px-3 py-2 font-mono-tab text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.type === "Eldiven" ? "bg-amber-950/60 text-amber-300" : "bg-blue-950/60 text-blue-300"}`}>{row.type}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-100">{row.name}</td>
                  <td className="px-3 py-2 text-slate-400">{row.detail}</td>
                  <td className={`px-3 py-2 text-right font-mono-tab font-bold ${row.type === "Eldiven" ? "text-amber-300" : "text-blue-300"}`}>{row.quantity}</td>
                  <td className="px-3 py-2 text-slate-300">{row.personnel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
