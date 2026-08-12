import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { Wrench, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setErr("Bağlantıda token bulunamadı. Lütfen yeni bir sıfırlama talebi oluşturun.");
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) return setErr("Şifre en az 6 karakter olmalı");
    if (password !== confirm) return setErr("Şifreler eşleşmiyor");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => nav("/giris"), 2500);
    } catch (e) {
      setErr(e.response?.data?.detail || "Sıfırlama başarısız. Bağlantı süresi dolmuş olabilir.");
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
              <h1 className="font-display text-2xl font-bold mb-1">Yeni Şifre Belirle</h1>
              <p className="text-slate-400 text-sm mb-6">Yeni şifrenizi girip onaylayın (en az 6 karakter).</p>

              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Yeni Şifre</label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password"
                    className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Şifreyi Tekrar Girin</label>
                  <input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm"
                    className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                {err && (
                  <div data-testid="reset-error" className="flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
                  </div>
                )}
                <button type="submit" disabled={loading || !token} data-testid="reset-submit"
                  className="w-full h-14 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  Şifreyi Güncelle
                </button>
              </form>
            </>
          ) : (
            <div data-testid="reset-done" className="text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Şifreniz Güncellendi</h2>
              <p className="text-slate-400 text-sm">Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz…</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm text-slate-400">
            <Link to="/giris" className="text-blue-400 hover:text-blue-300 font-semibold">Giriş sayfasına dön</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
