import React, { useEffect, useState } from "react";
import { FloorPlans, Beacons } from "@/lib/api";
import InteractiveMap from "@/components/InteractiveMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Radio, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminBeacons() {
  const [fp, setFp] = useState(null);
  const [beacons, setBeacons] = useState([]);
  const [draft, setDraft] = useState(null);
  const [label, setLabel] = useState("Beacon A");
  const [bleMac, setBleMac] = useState("");
  const [wifiMac, setWifiMac] = useState("");
  const [ssid, setSsid] = useState("");
  const [txPower, setTxPower] = useState(-59);

  async function reload() {
    const a = await FloorPlans.active();
    setFp(a);
    if (a) setBeacons(await Beacons.list(a.id));
  }
  useEffect(() => {
    reload();
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, []);

  function onMapClick(x, y) {
    setDraft({ x, y });
  }

  async function save() {
    if (!fp || !draft) return toast.error("Click on the map first to place beacon");
    if (!bleMac && !wifiMac) return toast.error("Provide at least BLE MAC or Wi-Fi MAC");
    try {
      await Beacons.create({
        floorplan_id: fp.id,
        label,
        ble_mac: bleMac.toUpperCase() || null,
        wifi_mac: wifiMac.toUpperCase() || null,
        ssid: ssid || null,
        tx_power: Number(txPower),
        x: draft.x,
        y: draft.y,
      });
      toast.success(`${label} placed`);
      setDraft(null);
      const next = String.fromCharCode(label.charCodeAt(label.length - 1) + 1);
      setLabel(`Beacon ${next}`);
      setBleMac(""); setWifiMac(""); setSsid("");
      reload();
    } catch (e) {
      toast.error("Failed to save beacon");
    }
  }

  async function remove(id) {
    await Beacons.remove(id);
    toast.success("Removed");
    reload();
  }

  return (
    <div className="p-6" data-testid="admin-beacons">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Beacons</p>
      <h1 className="text-2xl font-bold mt-1 text-zinc-900">Place ESP32-S3 Beacons</h1>
      <p className="text-zinc-600 mt-1 text-sm">Click anywhere on the floor plan to drop a beacon. Add its BLE MAC (from your ESP32-S3 Arduino sketch) and Wi-Fi MAC.</p>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
        <div className="h-[calc(100vh-220px)] min-h-[500px]">
          <InteractiveMap
            floorplan={fp}
            beacons={beacons}
            onMapClick={onMapClick}
            interactive
            overlay={
              draft && (
                <div
                  className="absolute pointer-events-none w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[#0055FF] bg-blue-200/40 animate-pulse z-30"
                  style={{ left: `${(draft.x / (fp?.width || 1)) * 100}%`, top: `${(draft.y / (fp?.height || 1)) * 100}%` }}
                  data-testid="draft-beacon-marker"
                />
              )
            }
          />
        </div>

        <div className="space-y-4">
          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900">{draft ? "New Beacon" : "Click map to place"}</h3>
              <div className="space-y-3 mt-3">
                <div>
                  <Label>Label</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="beacon-label-input" />
                </div>
                <div>
                  <Label>BLE MAC Address</Label>
                  <Input placeholder="AA:BB:CC:DD:EE:FF" value={bleMac} onChange={(e) => setBleMac(e.target.value)} data-testid="beacon-ble-mac-input" />
                </div>
                <div>
                  <Label>Wi-Fi MAC Address</Label>
                  <Input placeholder="11:22:33:44:55:66" value={wifiMac} onChange={(e) => setWifiMac(e.target.value)} data-testid="beacon-wifi-mac-input" />
                </div>
                <div>
                  <Label>Wi-Fi SSID (SoftAP)</Label>
                  <Input placeholder="ESP32_BEACON_A" value={ssid} onChange={(e) => setSsid(e.target.value)} data-testid="beacon-ssid-input" />
                </div>
                <div>
                  <Label>TX Power @ 1m (dBm)</Label>
                  <Input type="number" value={txPower} onChange={(e) => setTxPower(e.target.value)} data-testid="beacon-txpower-input" />
                </div>
                <Button onClick={save} className="bg-zinc-900 hover:bg-zinc-800 w-full" data-testid="beacon-save-btn">
                  <Plus className="w-4 h-4 mr-2" /> Save Beacon
                </Button>
                {draft && (
                  <Button variant="ghost" className="w-full" onClick={() => setDraft(null)} data-testid="beacon-cancel-btn">Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <Radio className="w-4 h-4" /> Beacons ({beacons.length})
              </h3>
              <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                {beacons.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-zinc-50" data-testid={`beacon-list-${b.id}`}>
                    <div>
                      <div className="font-medium text-zinc-900 flex items-center gap-2">
                        {b.label}
                        <Badge variant={b.online ? "default" : "secondary"} className={b.online ? "bg-emerald-500" : ""}>
                          {b.online ? "Online" : "Offline"}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{b.ble_mac || b.wifi_mac}</div>
                    </div>
                    <button onClick={() => remove(b.id)} className="text-red-500 hover:text-red-700" data-testid={`delete-beacon-${b.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {beacons.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No beacons yet</p>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
