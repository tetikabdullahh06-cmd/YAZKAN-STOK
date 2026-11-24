import { Download, FileUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthStartISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const TONES = {
  slate: "bg-slate-800 border-slate-700 text-slate-100",
  emerald: "bg-emerald-950/40 border-emerald-800/50 text-emerald-300",
  amber: "bg-amber-950/40 border-amber-800/50 text-amber-300",
  blue: "bg-blue-950/40 border-blue-800/50 text-blue-300",
  red: "bg-red-950/40 border-red-800/50 text-red-300",
};

export function Kpi({ label, value, tone = "slate", suffix }) {
  return (
    <div className={`border rounded-xl p-3 ${TONES[tone] || TONES.slate}`}>
      <div className="text-[11px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-black font-mono-tab leading-tight">
        {value}
        {suffix ? <span className="text-sm ml-1 opacity-70 font-semibold">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function DateRangeFields({ from, to, setFrom, setTo }) {
  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Başlangıç</label>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)}
          className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Bitiş</label>
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)}
          className="h-12 bg-slate-950 border border-slate-700 rounded-lg px-3 text-slate-100" />
      </div>
    </>
  );
}

export function ActionButtons({ onExport, onImport, exportDisabled, importLabel = "İçe Aktar" }) {
  const { isAdmin } = useAuth();
  return (
    <div className="flex gap-2 ml-auto flex-wrap">
      {isAdmin && (
        <button onClick={onImport} data-testid="movements-import"
          className="h-12 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold inline-flex items-center gap-2">
          <FileUp className="w-4 h-4" /> {importLabel}
        </button>
      )}
      <button onClick={onExport} disabled={exportDisabled} data-testid="movements-export"
        className="h-12 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold inline-flex items-center gap-2">
        <Download className="w-4 h-4" /> Excel’e Aktar
      </button>
    </div>
  );
}

export function EmptyRow({ colSpan, text = "Kayıt bulunamadı" }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">{text}</td>
    </tr>
  );
}

export const formatDay = (value) => {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
};
