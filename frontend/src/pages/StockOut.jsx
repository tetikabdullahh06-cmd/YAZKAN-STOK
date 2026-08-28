import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";
import QrScannerButton from "@/components/QrScanner";

const normalizeScan = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/gi, " ").trim().replace(/\s+/g, " ");
const findProductByScan = (list, raw) => {
  const scanned = normalizeScan(raw);
  if (!scanned) return null;
  const scannedTokens = scanned.split(" ").filter((token) => token.length >= 2);
  return list.map((p) => {
    const code = normalizeScan(p.code);
    const name = normalizeScan(p.name);
    const full = normalizeScan(`${p.code || ""} ${p.name || ""} ${p.brand || ""}`);
    const candidateTokens = full.split(" ").filter((token) => token.length >= 2);
    const hits = scannedTokens.filter((token) => candidateTokens.some((candidate) => token === candidate || (token.length >= 3 && candidate.length >= 3 && (token.includes(candidate) || candidate.includes(token)))));
    let score = hits.length ? 25 + hits.length * 18 + (hits.length / Math.max(1, Math.min(scannedTokens.length, candidateTokens.length))) * 45 : 0;
    if (code && scanned === code) score = 180;
    else if (name && scanned === name) score = 170;
    else if (full && (full.includes(scanned) || scanned.includes(full))) score = Math.max(score, 130);
    else if (code && (scanned.includes(code) || code.includes(scanned))) score = Math.max(score, 120);
    else if (name && (scanned.includes(name) || name.includes(scanned))) score = Math.max(score, 110);
    return { p, score };
  }).filter((x) => x.score >= 45).sort((a, b) => b.score - a.score)[0]?.p || null;
};

export default function StockOut() {
  const [products, setProducts] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [machines, setMachines] = useState([]);
  const [toolholders, setToolholders] = useState([]);
  const [productId, setProductId] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [toolholderId, setToolholderId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [productionProduct, setProductionProduct] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [formKey, setFormKey] = useState(0);

  const reload = () => Promise.all([
    api.get("/products").then((r) => setProducts(r.data)),
    api.get("/personnel").then((r) => setPersonnel(r.data)),
    api.get("/machines").then((r) => setMachines(r.data)),
    api.get("/toolholders").then((r) => setToolholders(r.data)),
  ]);

  useEffect(() => { reload(); }, []);

  const resetForm = () => {
    setProductId("");
    setPersonnelId("");
    setMachineId("");
    setToolholderId("");
    setQuantity("");
    setNote("");
    setProductionProduct("");
    setQuery("");
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setFormKey((key) => key + 1);
  };

  const selected = products.find((p) => p.id === productId);
  const filteredProducts = products.filter((p) => {
    const s = query.toLowerCase().trim();
    return !s || [p.code, p.name, p.brand].some((value) => String(value || "").toLowerCase().includes(s));
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || !personnelId || !machineId) return toast.error("Tüm alanları doldurun");
    setLoading(true);
    try {
      const r = await api.post("/stock/out", {
        product_id: productId, quantity: parseFloat(quantity),
        personnel_id: personnelId, machine_id: machineId, toolholder_id: toolholderId, note, production_product: productionProduct, transaction_date: transactionDate,
      });
      if (r.data.critical) toast.warning(`Stok çıkışı kaydedildi. UYARI: Kritik seviyede! Yeni stok: ${r.data.new_stock}`);
      else toast.success(`Stok çıkışı kaydedildi. Yeni stok: ${r.data.new_stock}`);
      resetForm();
      await reload();
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
            const match = findProductByScan(products, code);
            if (match) {
              setProductId(match.id);
              setQuery(`${match.code || "Kodsuz"} — ${match.name}${match.brand ? ` | Marka: ${match.brand}` : ""}`);
              toast.success(`Kayıtlı ürün bulundu: ${match.name}${match.brand ? ` — ${match.brand}` : ""}`);
            } else toast.error(`QR/barkod metniyle eşleşen kayıtlı ürün bulunamadı: ${code}`);
          }}
          testid="so-qr"
        />
      </div>

      <form key={formKey} onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Ürün Ara</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} data-testid="so-search"
            placeholder="Kod, isim veya marka ile ara..."
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 mb-2 focus:ring-2 focus:ring-red-500 outline-none" />
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} data-testid="so-product"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-red-500 outline-none">
            <option value="">-- Ürün seçin --</option>
            {filteredProducts.map((p) => <option key={p.id} value={p.id}>Marka: {p.brand || "Marka yok"} | {p.code} — {p.name} | Mevcut: {p.current_stock} {p.unit}</option>)}
          </select>
          {selected && (
            <div className="mt-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-slate-200">
              <span className="font-bold text-red-300">Seçilen marka:</span> {selected.brand || selected.manufacturer || selected.marka || "Marka bilgisi yok"}
            </div>
          )}
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
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Takım Tutucu <span className="text-slate-500 normal-case">(isteğe bağlı)</span></label>
          <select value={toolholderId} onChange={(e) => setToolholderId(e.target.value)} data-testid="so-toolholder"
            className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-red-500 outline-none">
            <option value="">-- Ürün tutucuya bağlanmıyorsa boş bırakın --</option>
            {toolholders.map((h) => <option key={h.id} value={h.id}>{h.code ? `${h.code} — ` : ""}{h.name}{h.brand ? ` | ${h.brand}` : ""} | Mevcut: {h.current_stock ?? 0}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Üretim / İşlenen Ürün</label>
          <input value={productionProduct} onChange={(e) => setProductionProduct(e.target.value)} placeholder="Örn. Flanş gövdesi, mil, parça kodu" data-testid="so-production-product" className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-red-500 outline-none" />
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
