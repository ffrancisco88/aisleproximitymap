import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import CustomerView from "./pages/CustomerView";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminFloorPlan from "./pages/admin/AdminFloorPlan";
import AdminBeacons from "./pages/admin/AdminBeacons";
import AdminAisles from "./pages/admin/AdminAisles";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminSetup from "./pages/admin/AdminSetup";
import Landing from "./pages/Landing";


function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors closeButton />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/customer" element={<CustomerView />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="floorplan" element={<AdminFloorPlan />} />
            <Route path="beacons" element={<AdminBeacons />} />
            <Route path="aisles" element={<AdminAisles />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="setup" element={<AdminSetup />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
