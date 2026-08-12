import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import YazkanLogo from "@/components/YazkanLogo";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) nav("/");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1717386255767-52643970d483?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000')",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/85" />
      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50">
            <YazkanLogo className="w-9 h-9 text-white" />
          </div>
          <div>
            <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold">Endüstriyel Stok</div>
            <div className="font-display text-2xl font-black text-slate-50 leading-tight">YAZKAN DÖKÜM TAKIMHANE</div>
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="font-display text-2xl font-bold mb-1">Giriş Yap</h1>
          <p className="text-slate-400 text-sm mb-6">Takımhane sistemine erişim için giriş yapın.</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="ornek@fabrika.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Şifre</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="w-full h-14 bg-slate-950 border border-slate-700 rounded-lg px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {err && (
              <div data-testid="login-error" className="text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">{err}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full h-14 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Giriş Yap
            </button>

            <div className="text-center">
              <Link to="/sifremi-unuttum" data-testid="login-forgot-link" className="text-sm text-blue-400 hover:text-blue-300 font-semibold">
                Şifremi Unuttum
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-sm text-slate-400">
            Hesabınız yok mu?{" "}
            <Link to="/kayit" data-testid="login-goto-register" className="text-blue-400 hover:text-blue-300 font-semibold">Kayıt Ol</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
