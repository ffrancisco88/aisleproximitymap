import React, { useEffect, useState } from "react";
import { Stats, FloorPlans } from "@/lib/api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Image, Radio, ShoppingBag, LayoutGrid, CheckCircle2, Circle } from "lucide-react";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [fp, setFp] = useState(null);

  useEffect(() => {
    Stats.get().then(setStats).catch(() => {});
    FloorPlans.active().then(setFp).catch(() => {});
  }, []);

  const cards = [
    { label: "Floor Plans", key: "floorplans", icon: Image, to: "/admin/floorplan", color: "bg-blue-100 text-blue-700" },
    { label: "Beacons", key: "beacons", icon: Radio, to: "/admin/beacons", color: "bg-emerald-100 text-emerald-700" },
    { label: "Aisles", key: "aisles", icon: LayoutGrid, to: "/admin/aisles", color: "bg-violet-100 text-violet-700" },
    { label: "Products", key: "products", icon: ShoppingBag, to: "/admin/products", color: "bg-orange-100 text-orange-700" },
  ];

  const checklist = [
    { label: "Upload floor plan", done: !!fp, to: "/admin/floorplan" },
    { label: "Place 4 ESP32-S3 beacons", done: (stats?.beacons ?? 0) >= 4, to: "/admin/beacons" },
    { label: "Define aisles", done: (stats?.aisles ?? 0) > 0, to: "/admin/aisles" },
    { label: "Add products with promos", done: (stats?.products ?? 0) > 0, to: "/admin/products" },
    { label: "Read Windows 10 setup guide", done: false, to: "/admin/setup" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto" data-testid="admin-overview">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Overview</p>
      <h1 className="text-3xl font-bold mt-2 text-zinc-900">Welcome back</h1>
      <p className="text-zinc-600 mt-1">Set up your store, beacons, and promos.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {cards.map((c) => (
          <Link to={c.to} key={c.key}>
            <Card className="hover:shadow-md transition-shadow border-zinc-200 cursor-pointer" data-testid={`stat-${c.key}`}>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-lg grid place-items-center ${c.color}`}>
                  <c.icon className="w-4 h-4" />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 mt-4 font-bold">{c.label}</p>
                <p className="text-3xl font-bold text-zinc-900 mt-1">{stats?.[c.key] ?? "—"}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-10 border-zinc-200">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Setup Checklist</h2>
          <ul className="mt-4 space-y-2">
            {checklist.map((c, i) => (
              <li key={i}>
                <Link to={c.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors" data-testid={`checklist-${i}`}>
                  {c.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-300" />
                  )}
                  <span className={`text-sm ${c.done ? "text-zinc-500 line-through" : "text-zinc-900 font-medium"}`}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-8 p-5 rounded-xl bg-[#0055FF] text-white">
        <p className="text-xs uppercase tracking-[0.28em] opacity-70 font-bold">Beacon Status</p>
        <p className="text-2xl font-bold mt-1">
          {stats?.online_beacons ?? 0} / {stats?.beacons ?? 0} online
        </p>
        <p className="text-sm opacity-80 mt-1">Beacons auto-go offline 30s after last heartbeat.</p>
      </div>
    </div>
  );
}
