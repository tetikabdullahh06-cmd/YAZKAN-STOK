import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, Users, Settings2, ArrowDownToLine, ArrowUp, PackagePlus,
  ArrowUpFromLine, History, AlertTriangle, FileBarChart2, LogOut, Wrench,
  Building2, ClipboardList, Eye, ShieldCheck, Cog, BarChart3, Cable, PackageX
} from "lucide-react";
import YazkanLogo from "@/components/YazkanLogo";

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/stok-cikis", label: "Stok Çıkışı", icon: ArrowUpFromLine, testid: "nav-stock-out", adminOnly: true },
  { to: "/stok-giris", label: "Stok Girişi", icon: ArrowDownToLine, testid: "nav-stock-in", adminOnly: true },
  { to: "/eldiven", label: "Eldiven Takip", icon: PackagePlus, testid: "nav-gloves", adminOnly: true },
  { to: "/bileme", label: "Bilemeye Giden / Gelen", icon: Wrench, testid: "nav-sharpening", adminOnly: true },
  { to: "/denemeler", label: "Kesici Takım Denemeleri", icon: BarChart3, testid: "nav-tool-trials", adminOnly: true },
  { to: "/receteler", label: "İşleme Reçeteleri", icon: Cable, testid: "nav-recipes", adminOnly: true },
  { to: "/urunler", label: "Ürünler", icon: Package, testid: "nav-products" },
  { to: "/personel", label: "Personel", icon: Users, testid: "nav-personnel" },
  { to: "/tezgahlar", label: "Tezgahlar", icon: Settings2, testid: "nav-machines" },
  { to: "/takim-tutucular", label: "Takım Tutucular", icon: Wrench, testid: "nav-toolholders" },
  { to: "/hurda-tutucular", label: "Hurda / Kullanım Dışı", icon: PackageX, testid: "nav-holder-scrap", adminOnly: true },
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
  const mainRef = useRef(null);
  const [showBackToTop] = useState(true);
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  const backToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex app-shell grain">
      <aside className="w-72 border-r app-sidebar hidden md:flex flex-col relative z-10">
        <div className="px-6 py-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl app-brand flex items-center justify-center">
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
                    ? "bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-900/20"
                    : "text-slate-500 hover:bg-cyan-50 hover:text-blue-700"
                }`
              }
            >
              <n.icon className="w-5 h-5 shrink-0" strokeWidth={2} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 relative z-[100]">
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
            style={{ backgroundColor: "#0f172a", color: "#ffffff", minHeight: 48, display: "flex", width: "100%", visibility: "visible", opacity: 1, position: "relative", zIndex: 100 }}
            className="w-full h-12 rounded-lg border border-slate-500 flex items-center justify-center gap-2 transition-colors font-bold"
          >
            <LogOut className="w-4 h-4" /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 h-14 app-mobile-bar border-b flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg app-brand flex items-center justify-center">
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

      <main ref={mainRef} className="min-w-0 w-0 flex-1 overflow-y-auto overflow-x-hidden relative z-10 pt-14 md:pt-0">
        <div className="min-w-0 w-full p-4 md:p-8 lg:p-12 max-w-[1600px]">
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
        <div className="md:hidden fixed bottom-0 inset-x-0 app-mobile-nav border-t grid grid-cols-5 z-20">
          {nav.slice(0, 5).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-16 gap-1 text-xs ${
                  isActive ? "text-blue-600 font-bold" : "text-slate-500"
                }`
              }
            >
              <n.icon className="w-5 h-5" />
              <span className="truncate">{n.label.split(" ")[0]}</span>
            </NavLink>
          ))}
        </div>
      </main>
      {showBackToTop && (
        <button
          type="button"
          onClick={backToTop}
          aria-label="Başa dön"
          data-testid="back-to-top"
          className="fixed right-6 bottom-6 z-[9999] inline-flex items-center gap-2 rounded-full !bg-blue-600 hover:!bg-blue-500 !text-white border border-blue-300 px-4 py-3 font-black shadow-2xl shadow-blue-900/40 opacity-100"
        >
          <ArrowUp className="w-5 h-5" /> Başa Dön
        </button>
      )}
    </div>
  );
}
