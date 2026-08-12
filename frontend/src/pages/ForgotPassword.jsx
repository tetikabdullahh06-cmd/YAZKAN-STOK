import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { Wrench, Loader2, ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch {
      // Endpoint always returns 200 by design; if it fails, still show generic message to avoid enumeration.
      setDone(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1717386255767-52643970d483?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000')" }} />
      <div className="absolute inset-0 bg-slate-950/85" />
      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Wrench className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">Endüstriyel Stok</div>
            <div className="font-display text-2xl font-black text-slate-50 leading-tight">YAZKAN DÖKÜM TAKIMHANE</div>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {!done ? (
            <>
              <h1 className="font-display text-2xl font-bold mb-1">Şifremi Unuttum</h1>
              <p className="text-slate-400 text-sm mb-6">Kayıtlı e-postanızı girin, şifre sıfırlama bağlantısı göndereceğiz.</p>

              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">E-posta</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email"
                    className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <button type="submit" disabled={loading} data-testid="forgot-submit"
                  className="w-full h-14 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  Sıfırlama Bağlantısı Gönder
                </button>
              </form>
            </>
          ) : (
            <div data-testid="forgot-done" className="text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4">
                <MailCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">E-postanızı Kontrol Edin</h2>
              <p className="text-slate-400 text-sm">Eğer bu adres sistemde kayıtlıysa, birkaç dakika içinde sıfırlama bağlantısını içeren bir e-posta alacaksınız. Gelen kutunuzu ve spam klasörünü kontrol edin.</p>
              <p className="text-slate-500 text-xs mt-4">Bağlantı 1 saat geçerlidir.</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm">
            <button onClick={() => nav("/giris")} className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Giriş sayfasına dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
