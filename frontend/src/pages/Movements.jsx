import { useState } from "react";
import { ArrowLeftRight, Boxes, Package, Sigma, Users } from "lucide-react";
import TotalsTab from "@/components/movements/TotalsTab";
import PersonnelConsumptionTab from "@/components/movements/PersonnelConsumptionTab";
import GloveConsumptionTab from "@/components/movements/GloveConsumptionTab";
import StockMovementsTab from "@/components/movements/StockMovementsTab";
import ItemMovementsTab from "@/components/movements/ItemMovementsTab";

const TABS = [
  { id: "totals", label: "Toplamlar", icon: Sigma, hint: "Tüm sarfiyat kalemleri: ay ay ürün ve eldiven toplamları, tek Excel'de aylık özet + detay sayfaları" },
  { id: "personnel", label: "Personel Sarfiyatı", icon: Users, hint: "Tarih aralığında personelin kullandığı takım/elmas/uç ve eldiven listesi" },
  { id: "glove", label: "Eldiven Sarfiyatı", icon: Package, hint: "Personel bazında eldiven kullanımı, aylık ve eldiven bazında toplamlar" },
  { id: "stock", label: "Stok Hareketleri", icon: ArrowLeftRight, hint: "Tüm ürünlerin giriş/çıkış hareketleri toplu liste" },
  { id: "item", label: "Ürün / Takım Tutucu", icon: Boxes, hint: "Seçilen ürün veya takım tutucunun tarih aralığındaki hareket detayı" },
];

export default function Movements() {
  const [tab, setTab] = useState("totals");
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-blue-400 uppercase tracking-[0.2em] font-semibold mb-2">Kayıtlar</div>
        <h1 className="font-display text-4xl font-black">Hareket Geçmişi</h1>
        <p className="text-slate-400 text-sm mt-1">{activeTab.hint}</p>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-2 flex gap-2 flex-wrap">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} data-testid={`movements-tab-${item.id}`}
              className={`h-12 px-4 rounded-xl font-bold inline-flex items-center gap-2 border transition-colors ${active
                ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30"
                : "bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "totals" && <TotalsTab />}
      {tab === "personnel" && <PersonnelConsumptionTab />}
      {tab === "glove" && <GloveConsumptionTab />}
      {tab === "stock" && <StockMovementsTab />}
      {tab === "item" && <ItemMovementsTab />}
    </div>
  );
}
