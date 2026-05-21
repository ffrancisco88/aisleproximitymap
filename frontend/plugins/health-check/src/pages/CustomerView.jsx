import React, { useEffect, useState, useRef, useCallback } from "react";
import { FloorPlans, Aisles, Beacons, Products, Positioning, Proximity, Routing } from "@/lib/api";
import InteractiveMap from "@/components/InteractiveMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Navigation2, X, Tag, Sparkles, ChevronUp, ChevronDown, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function CustomerView() {
  const [fp, setFp] = useState(null);
  const [beacons, setBeacons] = useState([]);
  const [aisles, setAisles] = useState([]);
  const [products, setProducts] = useState([]);
  const [pos, setPos] = useState(null);
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [targetProduct, setTargetProduct] = useState(null);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [promo, setPromo] = useState(null);
  const seenPromos = useRef(new Set());
  const [simMode, setSimMode] = useState(true);

  // Load floor plan + beacons + aisles + products
  useEffect(() => {
    (async () => {
      const a = await FloorPlans.active();
      setFp(a);
      if (a) {
        setBeacons(await Beacons.list(a.id));
        setAisles(await Aisles.list(a.id));
        setProducts(await Products.list(a.id));
        // default starting position center
        setPos({ x: a.width / 2, y: a.height * 0.9 });
      }
    })();
  }, []);

  // Proximity check whenever position changes
  useEffect(() => {
    if (!fp || !pos) return;
    Proximity.check(fp.id, pos.x, pos.y).then((res) => {
      // recompute route from new pos if target set
      if (targetProduct) {
        Routing.route({ floorplan_id: fp.id, from_x: pos.x, from_y: pos.y, product_id: targetProduct.id })
          .then((r) => { setRoute(r.waypoints); setSteps(r.steps); })
          .catch(() => {});
      }
      // fire promo for closest non-seen product
      const candidate = (res.nearby || []).find((p) => !seenPromos.current.has(p.id));
      if (candidate) {
        seenPromos.current.add(candidate.id);
        setPromo(candidate);
        setTimeout(() => setPromo((cur) => (cur && cur.id === candidate.id ? null : cur)), 6000);
      }
    });
  }, [pos, fp, targetProduct]);

  function onMapClick(x, y) {
    if (!simMode) return;
    setPos({ x, y });
  }

  async function startRoute(product) {
    if (!fp || !pos) return;
    try {
      const r = await Routing.route({ floorplan_id: fp.id, from_x: pos.x, from_y: pos.y, product_id: product.id });
      setRoute(r.waypoints);
      setSteps(r.steps);
      setTargetProduct(product);
      setSearchOpen(false);
      setSheetOpen(true);
      toast.success(`Navigating to ${product.name}`);
    } catch (e) {
      toast.error("Failed to compute route");
    }
  }

  function cancelRoute() {
    setRoute(null);
    setSteps([]);
    setTargetProduct(null);
  }

  const filtered = query
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : products.slice(0, 20);

  // Web Bluetooth scan (Chrome experimental)
  const [bleScanning, setBleScanning] = useState(false);
  const scanRef = useRef(null);
  async function startBleScan() {
    if (!("bluetooth" in navigator) || !navigator.bluetooth.requestLEScan) {
      toast.error("Web Bluetooth scan not supported in this browser. Enable chrome://flags/#enable-experimental-web-platform-features");
      return;
    }
    try {
      setBleScanning(true);
      setSimMode(false);
      const buffer = new Map();
      const scan = await navigator.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
      scanRef.current = scan;
      // navigator.bluetooth.addEventListener("advertisementreceived", (event) => {
      //   const mac = (event.device.id || "").toUpperCase();
      //   buffer.set(mac, event.rssi);
      // });
      navigator.bluetooth.addEventListener(
          "advertisementreceived",
          (event) => {

            console.log("BLE Device Found:", {
              id: event.device.id,
              name: event.device.name,
              rssi: event.rssi
            });

            // const mac = String(event.device.id || "")
            //   .replace(/-/g, ":")
            //   .toUpperCase();

            // buffer.set(mac, event.rssi);

            const beaconName =
              event.device.name || "";

            buffer.set(beaconName, event.rssi);
          }
        );


      // const interval = setInterval(async () => {
      //   if (buffer.size === 0 || !fp) return;
      //   const readings = Array.from(buffer.entries()).map(([mac, rssi]) => ({ mac, rssi, source: "ble" }));
      //   try {
      //     const p = await Positioning.scan(fp.id, readings);
      //     setPos({ x: p.x, y: p.y });
      //   } catch {}
      // }, 2000);

      //start new fix

      const interval = setInterval(async () => {
          if (buffer.size === 0 || !fp) return;

          // const readings = Array.from(buffer.entries()).map(([mac, rssi]) => ({
          //   mac: String(mac || "")
          //     .replace(/-/g, ":")
          //     .toUpperCase(),

          //   rssi: Number(rssi),

          //   source: "ble"
          // }));


        const readings = Array.from(buffer.entries()).map(([ssid, rssi]) => ({
             mac: ssid,
             rssi: Number(rssi),
             source: "ble"
          }))




          console.log("Sending scan:", {
            floorplan_id: fp.id,
            readings
          });

          try {
            const p = await Positioning.scan(fp.id, readings);

            console.log("Position result:", p);

            setPos({
              x: p.x,
              y: p.y
            });

          } catch (err) {
            console.error(
              "Scan error:",
              err.response?.data || err
            );
          }

        }, 2000);



//end new fix




      scanRef.current.interval = interval;
      toast.success("BLE scan started");
    } catch (e) {
      toast.error("Could not start BLE scan");
      setBleScanning(false);
    }
  }
  function stopBleScan() {
    if (scanRef.current) {
      if (scanRef.current.interval) clearInterval(scanRef.current.interval);
      try { scanRef.current.stop(); } catch {}
      scanRef.current = null;
    }
    setBleScanning(false);
    setSimMode(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-900 text-zinc-100" data-testid="customer-view">
      {/* Top search bar */}
      <div className="fixed top-0 inset-x-0 z-30 p-3">
        <div className="max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg flex items-center px-2 py-1.5">
            <button onClick={() => setSearchOpen(true)} className="flex-1 flex items-center gap-2 px-3 py-2 text-zinc-700 text-sm" data-testid="open-search-btn">
              <Search className="w-4 h-4 text-zinc-500" />
              <span className="truncate">Search products or aisles...</span>
            </button>
            <Button size="sm" variant={bleScanning ? "default" : "outline"} onClick={bleScanning ? stopBleScan : startBleScan} className="rounded-xl" data-testid="ble-scan-toggle">
              <Compass className="w-3.5 h-3.5 mr-1" />
              {bleScanning ? "Scanning" : "Locate"}
            </Button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 bg-zinc-200 relative">
        <InteractiveMap
          floorplan={fp}
          beacons={beacons}
          aisles={aisles}
          products={products}
          userPosition={pos}
          route={route}
          onMapClick={onMapClick}
          interactive={simMode}
          highlightProductId={targetProduct?.id}
          showProductDots={false}
        />
        {/* Sim mode hint */}
        {simMode && !route && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none" data-testid="sim-mode-hint">
            Tap the map to simulate your position
          </div>
        )}
      </div>

      {/* Proximity Promo Toast */}
      <AnimatePresence>
        {promo && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 left-3 right-3 max-w-md mx-auto bg-gradient-to-r from-orange-500 to-rose-500 text-white p-4 rounded-2xl shadow-2xl z-40 flex items-center gap-3"
            data-testid="proximity-promo-toast"
          >
            <img src={promo.image_url} alt="" className="w-14 h-14 rounded-xl object-cover bg-white/20" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] font-bold opacity-90">
                <Sparkles className="w-3 h-3" /> Promo nearby
              </div>
              <p className="font-bold text-base truncate">{promo.name}</p>
              <p className="text-xs opacity-90 truncate">{promo.promo_text || `Save ${promo.discount_percent}%`}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => startRoute(promo)} data-testid="promo-go-btn">
              Go
            </Button>
            <button onClick={() => setPromo(null)} data-testid="promo-close-btn"><X className="w-4 h-4 opacity-80" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet */}
      <motion.div
        animate={{ y: sheetOpen ? 0 : "65%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="fixed bottom-0 inset-x-0 bg-white text-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-30 max-h-[60vh]"
        data-testid="bottom-sheet"
      >
        <button onClick={() => setSheetOpen(!sheetOpen)} className="w-full pt-3 pb-1 flex flex-col items-center" data-testid="sheet-toggle">
          <div className="w-12 h-1.5 bg-zinc-300 rounded-full" />
        </button>
        <div className="px-5 pb-5">
          {targetProduct ? (
            <div data-testid="route-sheet">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Navigating to</p>
                  <h2 className="text-xl font-bold text-zinc-900">{targetProduct.name}</h2>
                </div>
                <Button size="sm" variant="outline" onClick={cancelRoute} data-testid="cancel-route-btn">
                  <X className="w-3.5 h-3.5 mr-1" /> Stop
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <img src={targetProduct.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">{targetProduct.name}</p>
                  <p className="text-xs text-zinc-600">${targetProduct.price} · <span className="text-orange-600 font-semibold">{targetProduct.discount_percent}% OFF</span></p>
                </div>
              </div>
              <div className="mt-4 max-h-[28vh] overflow-y-auto no-scrollbar space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50" data-testid={`turn-step-${i}`}>
                    <div className="w-7 h-7 rounded-full bg-[#0055FF] text-white grid place-items-center text-xs font-bold">{i + 1}</div>
                    <p className="text-sm text-zinc-800 flex-1">{s.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div data-testid="default-sheet">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Welcome</p>
                  <h2 className="text-xl font-bold text-zinc-900">Find products fast</h2>
                </div>
                <Badge className="bg-emerald-500 gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  {beacons.filter(b => b.online).length}/{beacons.length} beacons
                </Badge>
              </div>
              <Button className="w-full mt-4 bg-zinc-900 hover:bg-zinc-800 h-12" onClick={() => setSearchOpen(true)} data-testid="search-products-btn">
                <Search className="w-4 h-4 mr-2" /> Search products
              </Button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {products.slice(0, 4).map((p) => (
                  <button key={p.id} onClick={() => startRoute(p)} className="flex items-center gap-2 p-2.5 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-left" data-testid={`quick-product-${p.id}`}>
                    <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      {p.discount_percent > 0 && <p className="text-[10px] text-orange-600 font-bold">{p.discount_percent}% OFF</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-16 px-3"
            onClick={() => setSearchOpen(false)}
            data-testid="search-modal"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 flex items-center gap-2 border-b border-zinc-200">
                <Search className="w-4 h-4 text-zinc-500" />
                <Input autoFocus placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} className="border-0 focus-visible:ring-0 text-zinc-900" data-testid="search-input" />
                <button onClick={() => setSearchOpen(false)} data-testid="close-search-btn"><X className="w-4 h-4 text-zinc-500" /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {filtered.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No products found</p>}
                {filtered.map((p) => (
                  <button key={p.id} onClick={() => startRoute(p)} className="w-full text-left p-3 flex items-center gap-3 hover:bg-zinc-50 border-b border-zinc-100" data-testid={`search-result-${p.id}`}>
                    <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-zinc-100" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{p.description || (p.discount_percent > 0 ? `${p.discount_percent}% off` : `$${p.price}`)}</p>
                    </div>
                    <Navigation2 className="w-4 h-4 text-[#0055FF]" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
