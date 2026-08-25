import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Personnel from "@/pages/Personnel";
import Machines from "@/pages/Machines";
import StockIn from "@/pages/StockIn";
import StockOut from "@/pages/StockOut";
import Movements from "@/pages/Movements";
import CriticalStock from "@/pages/CriticalStock";
import Reports from "@/pages/Reports";
import Suppliers from "@/pages/Suppliers";
import Orders from "@/pages/Orders";
import TakimTutucular from "@/pages/TakimTutucular";
import HurdaTutucular from "@/pages/HurdaTutucular";
import Sharpening from "@/pages/Sharpening";
import ToolTrials from "@/pages/ToolTrials";
import Recipes from "@/pages/Recipes";
import Settings from "@/pages/Settings";
import ConsumptionDetail from "@/pages/ConsumptionDetail";
import Gloves from "@/pages/Gloves";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit" element={<Register />} />
          <Route path="/sifremi-unuttum" element={<ForgotPassword />} />
          <Route path="/sifre-sifirla" element={<ResetPassword />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="urunler" element={<Products />} />
            <Route path="personel" element={<Personnel />} />
            <Route path="tezgahlar" element={<Machines />} />
            <Route path="takim-tutucular" element={<TakimTutucular />} />
            <Route path="hurda-tutucular" element={<HurdaTutucular />} />
            <Route path="tedarikciler" element={<Suppliers />} />
            <Route path="siparisler" element={<Orders />} />
            <Route path="stok-giris" element={<StockIn />} />
            <Route path="bileme" element={<Sharpening />} />
            <Route path="denemeler" element={<ToolTrials />} />
            <Route path="receteler" element={<Recipes />} />
            <Route path="stok-cikis" element={<StockOut />} />
            <Route path="hareketler" element={<Movements />} />
            <Route path="kritik-stok" element={<CriticalStock />} />
            <Route path="raporlar" element={<Reports />} />
            <Route path="ayarlar" element={<Settings />} />
            <Route path="eldiven" element={<Gloves />} />
            <Route path="tuketim-detay/:kind/:id" element={<ConsumptionDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </AuthProvider>
  );
}
