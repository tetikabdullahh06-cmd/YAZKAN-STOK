import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";
import QrScannerButton from "@/components/QrScanner";

export default function StockOut() {
  const [products, setProducts] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [machines, setMachines] = useState([]);
  const [productId, setProductId] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const reload = () => Promise.all([
    api.get("/products").then((r) => setProducts(r.data)),
    api.get("/personnel").then((r) => setPersonnel(r.data)),
    api.get("/machines").then((r) => setMachines(r.data)),
  ]);

  useEffect(() => { reload(); }, []);

  const selected = products.find((p) => p.id === productId);
  const filteredProducts = products.filter((p) => {
    const s = query.toLowerCase();
    return !s || p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || !personnelId || !machineId) return toast.error("Tüm alanları doldurun");
    setLoading(true);
    try {
      const r = await api.post("/stock/out", {
        product_id: productId, quantity: parseFloat(quantity),
        personnel_id: personnelId, machine_id: machineId, note, transaction_date: transactionDate,
      });
      if (r.data.critical) toast.warning(`Stok çıkışı kaydedildi. UYARI: Kritik seviyede! Yeni stok: ${r.data.new_stock}`);
      else toast.success(`Stok çıkışı kaydedildi. Yeni stok: ${r.data.new_stock}`);
      setProductId(""); setQuantity(""); setNote(""); setQuery(""); setTransactionDate(new Date().toISOString().slice(0, 10));
      reload();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-red-400 uppercase tracking-[0.2em] font-semibold mb-2">Depodan Ver</div>
          <h1 className="font-display text-4xl font-black">Stok Çıkışı</h1>
          <p className="text-slate-400 text-sm mt-1">Personel ve tezgah bazlı hızlı çıkış.</p>
        </div>
        <QrScannerButton
          onScan={(code) => {
            const c = String(code).trim().toUpperCase();
            const match = products.find((p) => p.code.toUpperCase() === c);
            if (match) { setProductId(match.id); toast.success(`Ürün seçildi: ${match.name}`); }
            else toast.error(`Kod bulunamadı: ${code}`);
          }}
          testid="so-qr"
        />
      </div>

      <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ürün Ara</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="so-search"
            placeholder="Kod veya isim ile ara..."
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 mb-2 focus:ring-2 focus:ring-red-500 outline-none" />
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} data-testid="so-product"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-red-500 outline-none">
            <option value="">-- Ürün seçin --</option>
            {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name} (Mevcut: {p.current_stock} {p.unit})</option>)}
          </select>
          {selected && selected.current_stock <= selected.min_stock && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-400"><AlertTriangle className="w-4 h-4" /> Bu ürün kritik seviyede</div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Miktar {selected ? `(mevcut: ${selected.current_stock} ${selected.unit})` : ""}</label>
          <input required type="number" step="0.01" min="0.01" max={selected?.current_stock} value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="so-qty"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-2xl font-bold font-mono-tab focus:ring-2 focus:ring-red-500 outline-none" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">İşlem Tarihi</label>
          <input required type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} data-testid="so-date" className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-red-500 outline-none" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Personel</label>

            <select required value={personnelId} onChange={(e) => setPersonnelId(e.target.value)} data-testid="so-personnel"
              className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-red-500 outline-none">
              <option value="">-- Seçin --</option>
              {personnel.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.department ? ` — ${p.department}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tezgah</label>
            <select required value={machineId} onChange={(e) => setMachineId(e.target.value)} data-testid="so-machine"
              className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-red-500 outline-none">
              <option value="">-- Seçin --</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Açıklama</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 focus:ring-2 focus:ring-red-500 outline-none" />
        </div>

        <button type="submit" disabled={loading} data-testid="so-submit"
          className="w-full h-16 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-red-900/40">
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowUpFromLine className="w-6 h-6" />}
          Çıkışı Kaydet
        </button>
      </form>
    </div>
  );
}
