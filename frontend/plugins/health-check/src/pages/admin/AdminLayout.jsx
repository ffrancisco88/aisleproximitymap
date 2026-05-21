import React from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { LayoutGrid, Image, Radio, LayoutDashboard, ShoppingBag, BookOpen, ExternalLink, MapPin } from "lucide-react";

const links = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/floorplan", label: "Floor Plan", icon: Image },
  { to: "/admin/beacons", label: "Beacons", icon: Radio },
  { to: "/admin/aisles", label: "Aisles", icon: LayoutGrid },
  { to: "/admin/products", label: "Products", icon: ShoppingBag },
  { to: "/admin/setup", label: "Windows Setup", icon: BookOpen },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-zinc-50">
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col" data-testid="admin-sidebar">
        <Link to="/" className="px-6 py-6 border-b border-zinc-200 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-900 grid place-items-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-zinc-900 text-sm">ProximityMap AI</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Admin Console</p>
          </div>
        </Link>
        <nav className="p-3 flex flex-col gap-1 flex-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-200">
          <Link to="/customer" className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-[#0055FF] hover:bg-blue-50" data-testid="open-customer-app">
            Open Customer App
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
