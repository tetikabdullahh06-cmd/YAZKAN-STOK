import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Loader2, Search, X, History, ShieldCheck } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { dateOnly } from "@/lib/dateFormat";
import { norm } from "@/lib/recipeCardData";
import { RETURN_CONDITIONS, makeReturnChoices, buildReturnPayload } from "@/lib/recipeReturns";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const fieldClass = "h-10 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500";
const amount = (value) => Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 6 });
const today = () => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date()).replace(/\./g, "/");
const requestId = () => globalThis.crypto?.randomUUID?.() || `return-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function RecipeReturns({ recipe, onChange, onClose }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null), [choices, setChoices] = useState({}), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [returnDate, setReturnDate] = useState(today), [note, setNote] = useState("");
  const [retryBody, setRetryBody] = useState(null), [loadError, setLoadError] = useState("");
  const [retryType, setRetryType] = useState("return");
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await api.get(`/recipes/${recipe.id}/returns`);
      setData(response.data); setChoices(makeReturnChoices(response.data.lines || []));
      return response.data;
    } catch (e) { const message = formatApiErrorDetail(e.response?.data?.detail) || "İade bilgileri yüklenemedi"; setLoadError(message); throw e; }
    finally { setLoading(false); }
  }, [recipe.id]);
  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const rows = data?.lines || [];
  const pending = data?.pending_operation;
  const queuedPayload = pending?.body || retryBody;
  const locked = sending || loading || Boolean(pending) || Boolean(retryBody) || !isAdmin;
  const currentRecipe = data?.recipe || recipe;
  const filtered = rows.filter((line) => !search || norm(`${line.code || ""} ${line.name || ""} ${line.brand || ""}`).includes(norm(search)));
  const selectedCount = rows.filter((line) => choices[line.line_id]?.selected).length;
  const outstanding = rows.reduce((total, line) => total + Number(line.outstanding_quantity || 0), 0);
  const setChoice = (id, key, value) => setChoices((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const send = async (payload, operation = "return") => {
    if (busy.current || !isAdmin) return;
    busy.current = true; setSending(true); setRetryBody(payload); setRetryType(operation);
    try {
      const response = await api.post(`/recipes/${recipe.id}/${operation === "bind" ? "bind" : "returns"}`, payload);
      setRetryBody(null); setNote("");
      toast.success(operation === "bind" ? "Tezgâh bağlantısı tamamlandı; stok ikinci kez düşülmedi" : response.data.duplicate ? "Bu iade zaten kaydedilmiş; stok tekrar artırılmadı" : "Seçili iadeler kaydedildi: sağlamlar stoğa, kırık/hurdalar hurda kayıtlarına işlendi");
      await Promise.all([refresh(), onChange?.()]).catch(() => toast.warning("Kayıt tamamlandı; güncel listeyi yeniden yükleyin"));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "İade tamamlanamadı; aynı işlemi güvenli şekilde yeniden deneyebilirsiniz");
      await refresh().catch(() => {});
    } finally { busy.current = false; setSending(false); }
  };
  const submit = (event) => {
    event.preventDefault(); if (locked) return;
    let payload;
    try { payload = buildReturnPayload(choices, rows, { request_id: requestId(), return_date: returnDate, note }); }
    catch (e) { return toast.error(e.message); }
    const summary = payload.items.map((item) => `${rows.find((line) => line.line_id === item.line_id)?.name || item.line_id}: ${amount(item.quantity)} — ${RETURN_CONDITIONS[item.condition]}`).join("\n");
    if (!window.confirm(`Yalnızca aşağıdaki gelen kalemler işlenecek:\n\n${summary}\n\nSağlamlar stoğa eklenir. Kırık/hurdalar için stok tekrar düşülmez. Kaydedilsin mi?`)) return;
    send(payload);
  };

  return <section id="recipe-return-panel" className="rounded-2xl border border-emerald-500/40 bg-slate-800/70 p-5 space-y-5" aria-label="Tezgâhtan takım iadesi">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-emerald-300 flex items-center gap-2"><ArrowDownToLine className="w-5 h-5"/>Tezgâhtan Gelen / Stoğa İade</h2><p className="text-sm text-slate-300 mt-1">{currentRecipe.name} — {currentRecipe.workpiece_name} · {currentRecipe.machine_name || currentRecipe.machine_code || "Tezgâh"}</p></div><button type="button" onClick={onClose} disabled={sending} className="p-2 rounded-lg hover:bg-slate-700" aria-label="İade panelini kapat"><X className="w-5 h-5"/></button></div>
    <div className="rounded-xl bg-emerald-950/30 border border-emerald-600/30 p-4 text-sm space-y-1"><p><strong>Sağlam:</strong> Seçtiğiniz miktar mevcut stoğa geri eklenir.</p><p><strong>Kırık / Hurda:</strong> Hurda / Kullanım Dışı sayfasına kaydedilir. Tezgâha gönderilirken stoktan düştüğü için ikinci kez düşülmez.</p><p className="text-slate-400">Gelmeyen kalemleri seçmeyin; tezgâhta kalmaya devam eder. Aynı kalemin bir kısmı sağlam, bir kısmı kırık ise ayrı iadeler halinde kaydedebilirsiniz. Tutucular da bağımsız iade alınabilir.</p></div>
    {!isAdmin && <p className="text-amber-300 text-sm">İade kaydetmek için yönetici yetkisi gereklidir. Geçmiş kayıtlarını görüntüleyebilirsiniz.</p>}
    {loadError && <div role="alert" className="text-red-300 text-sm flex flex-wrap gap-3">{loadError}<button type="button" onClick={() => refresh().catch(() => {})} className="underline">Tekrar yükle</button></div>}
    {loading && !data ? <div className="p-5 text-center"><Loader2 className="w-5 h-5 animate-spin inline"/> İade bilgileri yükleniyor</div> : data && <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><div className="rounded-lg border border-slate-700 p-3">Tezgâhta kalan toplam: <strong className="text-amber-300">{amount(outstanding)}</strong></div><div className="rounded-lg border border-slate-700 p-3">Sağlam iade: <strong className="text-emerald-300">{amount(rows.reduce((n, row) => n + Number(row.healthy_quantity || 0), 0))}</strong></div><div className="rounded-lg border border-slate-700 p-3">Kırık / hurda: <strong className="text-rose-300">{amount(rows.reduce((n, row) => n + Number(row.broken_quantity || 0) + Number(row.scrap_quantity || 0), 0))}</strong></div></div>
      {(pending || retryBody) && <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 text-amber-200 text-sm space-y-2"><p><ShieldCheck className="inline w-4 h-4 mr-1"/>Önceki işlemin sonucunu tamamlayın. Aynı işlem tekrar gönderildiğinde stok ikinci kez değiştirilmez.</p>{queuedPayload && <button type="button" onClick={() => send(queuedPayload, pending?.type || retryType)} disabled={sending || loading || !isAdmin} className="h-10 px-4 rounded-lg bg-amber-700 text-white font-semibold disabled:opacity-40">{sending ? "Tamamlanıyor…" : (pending?.type || retryType) === "bind" ? "Bağlantıyı Tamamla" : "Aynı İadeyi Yeniden Dene"}</button>}{pending?.type === "bind" && <p>Tezgâh bağlantısı henüz tamamlanmamış. İadeye geçmeden önce bağlantı işlemini tamamlayın.</p>}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end"><div className="flex-1 min-w-[200px]"><label htmlFor="recipe-return-search" className="block text-xs text-slate-400 mb-1">Gönderilen takımlar arasında ara</label><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-500"/><input id="recipe-return-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Takım adı, kod veya marka" className={`${fieldClass} pl-9`}/></div></div><div className="w-40"><label htmlFor="recipe-return-date" className="block text-xs text-slate-400 mb-1">İade tarihi (GG/AA/YY)</label><input id="recipe-return-date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} disabled={locked} className={fieldClass} placeholder="18/11/26"/></div></div>
        <div className="overflow-x-auto border border-slate-700 rounded-xl"><table className="w-full text-sm"><thead><tr className="text-left text-slate-400 bg-slate-950/40"><th className="p-3">Gelen kalemi seç</th><th className="p-3">Gönderilen</th><th className="p-3">Önceki sağlam / hurda</th><th className="p-3">Tezgâhta kalan</th><th className="p-3">Bu gelen miktar</th><th className="p-3">Geldiği durum</th><th className="p-3">Satır notu</th></tr></thead><tbody>{filtered.map((line) => {
          const choice = choices[line.line_id] || {}, done = Number(line.outstanding_quantity) <= 0;
          return <tr key={line.line_id} data-testid={`return-line-${line.line_id}`} className={`border-t border-slate-700 ${done ? "opacity-60" : ""}`}><td className="p-3 min-w-[210px]"><label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" checked={Boolean(choice.selected)} disabled={locked || done} onChange={(e) => setChoice(line.line_id, "selected", e.target.checked)} aria-label={`${line.name} gelen kalemini seç`} className="mt-1 accent-emerald-500"/><span><strong>{line.name}</strong><span className="block text-xs text-slate-400">{line.kind === "toolholder" ? "Tutucu" : "Takım"} · {line.code || "Kod yok"} · {line.brand || "Marka yok"}</span>{done && <span className="block text-xs text-emerald-400">İade / hurda işlemi tamamlandı</span>}</span></label></td><td className="p-3">{amount(line.sent_quantity)}</td><td className="p-3">{amount(line.healthy_quantity)} / {amount(Number(line.broken_quantity || 0) + Number(line.scrap_quantity || 0))}</td><td className="p-3 font-bold text-amber-300">{amount(line.outstanding_quantity)}</td><td className="p-3 min-w-[125px]"><input type="number" min="0.000001" step="0.000001" max={line.outstanding_quantity} value={choice.quantity ?? ""} disabled={locked || done || !choice.selected} onChange={(e) => setChoice(line.line_id, "quantity", e.target.value)} aria-label={`${line.name} iade miktarı`} className={fieldClass}/></td><td className="p-3 min-w-[200px]"><select value={choice.condition || "healthy"} disabled={locked || done || !choice.selected} onChange={(e) => setChoice(line.line_id, "condition", e.target.value)} aria-label={`${line.name} iade durumu`} className={fieldClass}>{Object.entries(RETURN_CONDITIONS).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></td><td className="p-3 min-w-[180px]"><input value={choice.note || ""} disabled={locked || done || !choice.selected} onChange={(e) => setChoice(line.line_id, "note", e.target.value)} aria-label={`${line.name} iade notu`} placeholder="Hasar / açıklama" className={fieldClass}/></td></tr>;
        })}</tbody></table>{filtered.length === 0 && <p className="p-4 text-slate-400">Aramayla eşleşen kalem yok.</p>}</div>
        <div><label htmlFor="recipe-return-note" className="block text-xs text-slate-400 mb-1">İade açıklaması (isteğe bağlı)</label><input id="recipe-return-note" value={note} onChange={(e) => setNote(e.target.value)} disabled={locked} className={fieldClass} placeholder="Teslim alma notu"/></div>
        {outstanding > 0 ? <button disabled={locked || selectedCount === 0} type="submit" className="h-11 px-5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-2 disabled:opacity-40">{sending ? <Loader2 className="w-4 h-4 animate-spin"/> : <ArrowDownToLine className="w-4 h-4"/>}Seçili Gelenleri Kaydet ({selectedCount})</button> : <p className="text-emerald-300 font-semibold">Tüm takım ve tutucuların iade / hurda işlemi tamamlandı. Bu reçete geçmiş kaydı olarak korunur.</p>}
      </form>
      <div className="border-t border-slate-700 pt-4 space-y-2"><h3 className="font-bold flex items-center gap-2"><History className="w-4 h-4"/>İade Geçmişi</h3>{(data.history || []).length === 0 ? <p className="text-sm text-slate-400">Henüz iade kaydı yok.</p> : [...data.history].reverse().map((entry, index) => <details key={entry.id || entry.request_id || index} className="rounded-lg border border-slate-700 p-3 text-sm"><summary className="cursor-pointer font-semibold">{dateOnly(entry.return_date || entry.created_at)} · {entry.user_name || entry.created_by || "Kayıt"} · {entry.items?.length || 0} kalem</summary><p className="text-slate-400 mt-2">{entry.machine_name || currentRecipe.machine_name || ""}{entry.note ? ` — ${entry.note}` : ""}</p><div className="space-y-1 mt-2">{(entry.items || []).map((item, i) => <div key={`${item.line_id}-${i}`} className={item.condition === "healthy" ? "text-emerald-300" : "text-rose-300"}>{item.name || rows.find((row) => row.line_id === item.line_id)?.name || "Kalem"} · {amount(item.quantity)} · {RETURN_CONDITIONS[item.condition] || item.condition}{item.note ? ` — ${item.note}` : ""}</div>)}</div></details>)}</div>
    </>}
  </section>;
}
