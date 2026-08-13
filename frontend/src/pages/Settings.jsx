import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, Loader2, KeyRound, Eye, EyeOff, Users } from "lucide-react";

export default function Settings() {
  const { user, isAdmin, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
    useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    api.get("/admin/users")
      .then((res) => setUsers(res.data))
      .catch((e) => setErr(e.response?.data?.detail || "Kullanıcılar yüklenemedi"))
      .finally(() => setUsersLoading(false));
  }, [isAdmin]);

  const resetUserPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || tempPassword.length < 6) {
      return setErr("Kullanıcı seçin ve en az 6 karakterlik geçici şifre yazın");
    }
    setUsersLoading(true);
    setErr("");
    try {
      await api.post("/admin/users/reset-password", {
        user_id: selectedUser,
        new_password: tempPassword,
      });
      toast.success("Kullanıcı şifresi güncellendi");
      setTempPassword("");
    } catch (e) {
      setErr(e.response?.data?.detail || "Kullanıcı şifresi güncellenemedi");
    }
    setUsersLoading(false);
  };


  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (next.length < 6) return setErr("Yeni şifre en az 6 karakter olmalı");
    if (next !== confirm) return setErr("Yeni şifreler eşleşmiyor");
    if (next === current) return setErr("Yeni şifre eskisiyle aynı olamaz");
    setLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Şifreniz güncellendi. Güvenlik için yeniden giriş yapmanız gerekiyor.");
      setCurrent(""); setNext(""); setConfirm("");
      // Force re-login for safety
      setTimeout(async () => { await logout(); window.location.href = "/giris"; }, 1200);
    } catch (e) {
      setErr(e.response?.data?.detail || "Şifre güncellenemedi");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Hesap</div>
        <h1 className="font-display text-4xl font-black">Ayarlar</h1>
        <p className="text-slate-400 text-sm mt-1">Hesap bilgilerinizi görüntüleyin ve şifrenizi değiştirin.</p>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${isAdmin ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-300" : "bg-amber-500/10 border border-amber-500/40 text-amber-300"}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold truncate">{user?.name}</div>
            <div className="text-sm text-slate-400 truncate">{user?.email}</div>
            <div className="text-xs mt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 ${isAdmin ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30" : "text-amber-300 bg-amber-500/10 border border-amber-500/30"}`}>
                {isAdmin ? "Yönetici" : "Görüntüleme"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-400" />
          <h2 className="font-display text-xl font-bold">Şifre Değiştir</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Mevcut Şifre</label>
          <div className="relative">
            <input required type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)}
              data-testid="settings-current"
              className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 pr-11 focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Yeni Şifre (en az 6 karakter)</label>
          <input required minLength={6} type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)}
            data-testid="settings-new"
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Yeni Şifreyi Tekrar Girin</label>
          <input required minLength={6} type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            data-testid="settings-confirm"
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        {err && <div data-testid="settings-error" className="text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3">{err}</div>}
        <button type="submit" disabled={loading} data-testid="settings-submit"
          className="h-12 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Şifreyi Güncelle
        </button>
      </form>
            {isAdmin && (
        <div className="bg-slate-800/60 border border-emerald-700/50 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="font-display text-xl font-bold">Kullanıcı Şifre Yönetimi</h2>
          </div>
          <p className="text-sm text-slate-400">
            Şifresini unutan görüntüleme kullanıcısı için geçici şifre belirleyebilirsiniz.
          </p>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 outline-none"
          >
            <option value="">Kullanıcı seçin</option>
            {users
              .filter((item) => item.id !== user?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.email} ({item.role === "admin" ? "Yönetici" : "Görüntüleme"})
                </option>
              ))}
          </select>
          <form onSubmit={resetUserPassword} className="flex gap-3 flex-wrap">
            <input
              type="password"
              minLength={6}
              required
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              placeholder="Yeni geçici şifre"
              className="flex-1 min-w-[220px] h-12 bg-slate-950 border border-slate-700 rounded-lg px-4 outline-none"
            />
            <button
              type="submit"
              disabled={usersLoading}
              className="h-12 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold"
            >
              Geçici Şifre Belirle
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
