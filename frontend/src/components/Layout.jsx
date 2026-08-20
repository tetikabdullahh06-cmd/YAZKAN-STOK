import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, Users, Settings2, ArrowDownToLine,
  ArrowUpFromLine, History, AlertTriangle, FileBarChart2, LogOut, Wrench,
  Building2, ClipboardList, Eye, ShieldCheck, Cog
} from "lucide-react";
import YazkanLogo from "@/components/YazkanLogo";

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/stok-cikis", label: "Stok Çıkışı", icon: ArrowUpFromLine, testid: "nav-stock-out", adminOnly: true },
  { to: "/stok-giris", label: "Stok Girişi", icon: ArrowDownToLine, testid: "nav-stock-in", adminOnly: true },
  { to: "/bileme", label: "Bilemeye Giden / Gelen", icon: Wrench, testid: "nav-sharpening", adminOnly: true },
  { to: "/urunler", label: "Ürünler", icon: Package, testid: "nav-products" },
  { to: "/personel", label: "Personel", icon: Users, testid: "nav-personnel" },
  { to: "/tezgahlar", label: "Tezgahlar", icon: Settings2, testid: "nav-machines" },
  { to: "/takim-tutucular", label: "Takım Tutucular", icon: Wrench, testid: "nav-toolholders" },
  { to: "/tedarikciler", label: "Tedarikçiler", icon: Building2, testid: "nav-suppliers" },
  { to: "/siparisler", label: "Siparişler", icon: ClipboardList, testid: "nav-orders" },
  { to: "/hareketler", label: "Hareketler", icon: History, testid: "nav-movements" },
  { to: "/kritik-stok", label: "Kritik Stok", icon: AlertTriangle, testid: "nav-critical" },
  { to: "/raporlar", label: "Raporlar", icon: FileBarChart2, testid: "nav-reports" },
  { to: "/ayarlar", label: "Ayarlar", icon: Cog, testid: "nav-settings" },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex bg-slate-900 grain">
      <aside className="w-72 border-r border-slate-800 bg-slate-950 hidden md:flex flex-col relative z-10">
        <div className="px-6 py-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <YazkanLogo className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="font-display text-base font-bold leading-tight">YAZKAN DÖKÜM</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest">Takımhane Stok</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 h-14 rounded-lg transition-all duration-200 font-medium text-base ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`
              }
            >
              <n.icon className="w-5 h-5 shrink-0" strokeWidth={2} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-xs text-slate-500 uppercase tracking-widest">Oturum</div>
              {isAdmin ? (
                <span data-testid="role-badge-admin" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                  <ShieldCheck className="w-3 h-3" /> Yönetici
                </span>
              ) : (
                <span data-testid="role-badge-viewer" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                  <Eye className="w-3 h-3" /> Görüntüleme
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-100 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={async () => { await logout(); navigate("/giris"); }}
            data-testid="logout-btn"
            className="w-full h-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <YazkanLogo className="w-5 h-5 text-white" />
          </div>
          <div className="font-display font-bold">YAZKAN DÖKÜM</div>
          {!isAdmin && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
              <Eye className="w-3 h-3" /> Görüntüleme
            </span>
          )}
        </div>
        <button onClick={async () => { await logout(); navigate("/giris"); }} className="text-slate-400">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <main className="flex-1 overflow-auto relative z-10 pt-14 md:pt-0">
        <div className="p-4 md:p-8 lg:p-12 max-w-[1600px]">
          {!isAdmin && (
            <div data-testid="viewer-banner" className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3">
              <Eye className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">Görüntüleme modu.</span>{" "}
                Verileri görüntüleyebilirsiniz; ekleme, düzenleme ve silme işlemleri sadece yönetici hesabında yapılabilir.
              </div>
            </div>
          )}
          <Outlet />
        </div>
        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 grid grid-cols-5 z-20">
          {nav.slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-16 gap-1 text-xs ${
                  isActive ? "text-blue-400" : "text-slate-500"
                }`
              }
            >
              <n.icon className="w-5 h-5" />
              <span className="truncate">{n.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </main>
    </div>
  );
}
