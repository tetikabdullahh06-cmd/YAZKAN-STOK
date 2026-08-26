import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import QrScannerButton from "@/components/QrScanner";

export default function StockIn() {
 const [products, setProducts] = useState([]);
 const [suppliers, setSuppliers] = useState([]);
 const [productId, setProductId] = useState("");
 const [productQuery, setProductQuery] = useState("");
 const [quantity, setQuantity] = useState("");
 const [supplierId, setSupplierId] = useState("");
 const [supplierManual, setSupplierManual] = useState("");
 const [note, setNote] = useState("");
 const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
 const [loading, setLoading] = useState(false);

 const reload = () => Promise.all([
  api.get("/products").then((r) => setProducts(r.data)),
  api.get("/suppliers").then((r) => setSuppliers(r.data)).catch(() => setSuppliers([])),
 ]);
 useEffect(() => { reload(); }, []);

 const selected = products.find((p) => p.id === productId);
 const filteredProducts = useMemo(() => {
  const query = productQuery.trim().toLocaleLowerCase("tr-TR");
  if (!query) return products;
  return products.filter((p) => `${p.code || ""} ${p.name || ""} ${p.brand || ""} ${p.category || ""}`.toLocaleLowerCase("tr-TR").includes(query));
 }, [products, productQuery]);

 const formatProduct = (p) => `${p.code || "Kodsuz"} — ${p.name} • Marka: ${p.brand || "Marka yok"} (Mevcut: ${p.current_stock} ${p.unit})`;
 const chooseProduct = (product) => {
  setProductId(product.id);
  setProductQuery(formatProduct(product));
 };

 const onScan = (code) => {
  const c = String(code).trim().toUpperCase();
  const match = products.find((p) => (p.code || "").toUpperCase() === c);
  if (match) { chooseProduct(match); toast.success(`Ürün seçildi: ${match.name}`); }
  else toast.error(`Kod bulunamadı: ${code}`);
 };

 const submit = async (e) => {
  e.preventDefault();
  if (!productId) return toast.error("Listeden bir ürün seçiniz");
  setLoading(true);
  const supplierName = supplierId ? suppliers.find((s) => s.id === supplierId)?.name || "" : supplierManual;
  try {
   const r = await api.post("/stock/in", {
    product_id: productId,
    quantity: parseFloat(quantity),
    supplier: supplierName,
    supplier_id: supplierId || null,
    note,
    transaction_date: transactionDate,
   });
   toast.success(`Stok girişi kaydedildi. Yeni stok: ${r.data.new_stock}`);
   setProductId(""); setProductQuery(""); setQuantity(""); setSupplierId(""); setSupplierManual(""); setNote(""); setTransactionDate(new Date().toISOString().slice(0, 10));
   reload();
  } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  setLoading(false);
 };

 return (
  <div className="max-w-3xl space-y-6">
   <div className="flex items-end justify-between flex-wrap gap-4">
    <div>
     <div className="text-xs text-emerald-400 uppercase tracking-[0.2em] font-semibold mb-2">Depoya Kaydet</div>
     <h1 className="font-display text-4xl font-black">Stok Girişi</h1>
     <p className="text-slate-400 text-sm mt-1">Depoya yeni gelen malzemeleri kaydedin.</p>
    </div>
    <QrScannerButton onScan={onScan} testid="si-qr" />
   </div>

   <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">
    <div>
     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ürün</label>
     <div className="relative">
      <input
       required
       type="text"
       value={productQuery}
       placeholder="Ürün adı veya kodu yazıp arayın..."
       onChange={(e) => {
        const value = e.target.value;
        setProductQuery(value);
        const exact = products.find((p) => formatProduct(p) === value);
        setProductId(exact ? exact.id : "");
       }}
       data-testid="si-product-search"
       className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-emerald-500 outline-none"
      />
      {productQuery.trim() && !selected && (
       <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        {filteredProducts.length > 0 ? filteredProducts.map((p) => (
         <button type="button" key={p.id} onClick={() => chooseProduct(p)} className="block w-full border-b border-slate-800 px-4 py-3 text-left text-sm text-slate-200 hover:bg-emerald-900/40 last:border-b-0">
          <span className="font-semibold">{p.code || "Kodsuz"}</span> — {p.name}
          <span className="ml-2 text-xs font-bold text-cyan-300">Marka: {p.brand || "Marka yok"}</span>
          <span className="ml-2 text-xs text-slate-300">Mevcut: {p.current_stock} {p.unit}</span>
         </button>
        )) : <div className="px-4 py-3 text-sm text-slate-400">Eşleşen ürün bulunamadı.</div>}
       </div>
      )}
     </div>
     {!productId && <p className="mt-2 text-xs text-slate-500">Arama sonucundan ürüne tıklayarak seçin.</p>}
    </div>

    <div>
     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Miktar {selected ? `(${selected.unit})` : ""}</label>
     <input required type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="si-qty"
      className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-2xl font-bold font-mono-tab focus:ring-2 focus:ring-emerald-500 outline-none" />
    </div>

    <div>
     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">İşlem Tarihi</label>
     <input required type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} data-testid="si-date" className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
    </div>

    <div>
     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tedarikçi</label>
     {suppliers.length > 0 ? (
      <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setSupplierManual(""); }} data-testid="si-supplier"
       className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-emerald-500 outline-none">
       <option value="">-- Kayıtlı tedarikçiden seç --</option>
       {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
     ) : <div className="text-xs text-slate-500 mb-2">Kayıtlı tedarikçi yok — elle yazın veya Tedarikçiler sayfasından ekleyin.</div>}
     {!supplierId && <input value={supplierManual} onChange={(e) => setSupplierManual(e.target.value)} placeholder="veya elle yazın..."
      className="w-full h-12 mt-2 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-emerald-500 outline-none" />}
    </div>

    <div>
     <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Açıklama</label>
     <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 focus:ring-2 focus:ring-emerald-500 outline-none" />
    </div>

    <button type="submit" disabled={loading} data-testid="si-submit"
     className="w-full h-16 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-emerald-900/40">
     {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowDownToLine className="w-6 h-6" />}
     Girişi Kaydet
    </button>
   </form>
  </div>
 );
}
