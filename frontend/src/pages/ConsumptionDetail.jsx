import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, PackageSearch } from "lucide-react";
import { utils, writeFile } from "xlsx";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ConsumptionDetail() {
  const { kind, id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isPersonnel = kind === "personel";
  const title = isPersonnel ? "Personel Tüketim Detayı" : "Tezgâh Tüketim Detayı";

  useEffect(() => {
    setLoading(true);
    const params = isPersonnel ? { personnel_id: id } : { machine_id: id };
    api.get("/reports/consumption-detail", { params })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e.response?.data?.detail || "Detay raporu yüklenemedi"))
      .finally(() => setLoading(false));
  }, [id, isPersonnel]);

  const label = useMemo(() => {
    const first = data?.movements?.[0];
    if (!first) return isPersonnel ? "Personel" : "Tezgâh";
    return isPersonnel ? first.personnel_name || "Personel" : first.machine_name || "Tezgâh";
  }, [data, isPersonnel]);

  const exportExcel = () => {
    if (!data?.rows?.length) return toast.error("Dışa aktarılacak tüketim kaydı yok");
    const rows = data.rows.map((r) => ({
      "Ürün Kodu": r.product_code,
      "Kullanılan Uç / Ürün": r.product_name,
      "Tezgâh Kodu": r.machine_code || "-",
      "Tezgâh Adı": r.machine_name || "-",
      "Üretim / İşlenen Ürün": r.production_product,
      "Toplam Tüketim": r.quantity,
      "Hareket Sayısı": r.movement_count,
    }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), "Tüketim Detayı");
    writeFile(wb, `${isPersonnel ? "personel" : "tezgah"}_tuketim_${label.replace(/[^a-z0-9çğıöşü -]/gi, "_")}.xlsx`);
  };

  if (loading) return <div className="flex items-center gap-3 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /> Detay raporu yükleniyor...</div>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-3"><ArrowLeft className="w-4 h-4" /> Ana panele dön</Link><div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">{title}</div><h1 className="font-display text-4xl font-black">{label}</h1><p className="text-slate-400 text-sm mt-1">Hangi uçtan ne kadar tüketildiğinin toplamı.</p></div>
        <button onClick={exportExcel} className="inline-flex items-center gap-2 h-12 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"><Download className="w-5 h-5" /> Excel’e Aktar</button>
      </div>
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden"><div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2"><PackageSearch className="w-5 h-5 text-blue-400" /><h2 className="font-display text-xl font-bold">Ürün Bazlı Tüketim</h2></div><div className="overflow-auto"><table className="w-full text-sm"><thead className="bg-slate-900/60"><tr className="text-left text-slate-300"><th className="px-6 py-3">Ürün Kodu</th><th className="px-6 py-3">Kullanılan Uç / Ürün</th><th className="px-6 py-3">Tezgâh</th><th className="px-6 py-3">Üretim / İşlenen Ürün</th><th className="px-6 py-3">Toplam Tüketim</th><th className="px-6 py-3">İşlem Sayısı</th></tr></thead><tbody className="divide-y divide-slate-700">{!data?.rows?.length ? <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">Henüz tüketim kaydı yok.</td></tr> : data.rows.map((r) => <tr key={`${r.product_id}-${r.production_product}`} className="hover:bg-slate-700/40"><td className="px-6 py-3 font-mono-tab text-slate-400">{r.product_code || "-"}</td><td className="px-6 py-3 font-semibold">{r.product_name}</td><td className="px-6 py-3 text-slate-300"><div>{r.machine_code || "-"}</div><div className="text-xs text-slate-500">{r.machine_name || "-"}</div></td><td className="px-6 py-3 text-slate-300">{r.production_product}</td><td className="px-6 py-3 font-black text-emerald-400">{r.quantity}</td><td className="px-6 py-3 text-slate-300">{r.movement_count}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
const _unused = null;

