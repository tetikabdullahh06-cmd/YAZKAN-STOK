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
            <Route path="tedarikciler" element={<Suppliers />} />
            <Route path="siparisler" element={<Orders />} />
            <Route path="stok-giris" element={<StockIn />} />
            <Route path="stok-cikis" element={<StockOut />} />
            <Route path="hareketler" element={<Movements />} />
            <Route path="kritik-stok" element={<CriticalStock />} />
            <Route path="raporlar" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </AuthProvider>
  );
}
