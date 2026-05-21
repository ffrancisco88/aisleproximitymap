import React, { useEffect, useState, useRef } from "react";
import { FloorPlans, Aisles } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function AdminAisles() {
  const [fp, setFp] = useState(null);
  const [aisles, setAisles] = useState([]);
  const [drag, setDrag] = useState(null);
  const [name, setName] = useState("Aisle 1");
  const [color, setColor] = useState("#0055FF");
  const stageRef = useRef(null);

  async function reload() {
    const a = await FloorPlans.active();
    setFp(a);
    if (a) setAisles(await Aisles.list(a.id));
  }
  useEffect(() => { reload(); }, []);

  function pointFromEvent(e) {
    const rect = stageRef.current.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    return { x: rx * fp.width, y: ry * fp.height };
  }

  function onDown(e) {
    if (!fp) return;
    const p = pointFromEvent(e);
    setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }
  function onMove(e) {
    if (!drag) return;
    const p = pointFromEvent(e);
    setDrag({ ...drag, x2: p.x, y2: p.y });
  }
  async function onUp() {
    if (!drag) return;
    const w = Math.abs(drag.x2 - drag.x1);
    const h = Math.abs(drag.y2 - drag.y1);
    if (w < 20 || h < 20) { setDrag(null); return; }
    try {
      await Aisles.create({ floorplan_id: fp.id, name, color, ...drag });
      toast.success(`${name} created`);
      const next = (parseInt(name.replace(/\D+/g, ""), 10) || 0) + 1;
      setName(`Aisle ${next}`);
      setDrag(null);
      reload();
    } catch {
      toast.error("Failed to create aisle");
    }
  }

  async function remove(id) {
    await Aisles.remove(id);
    toast.success("Removed");
    reload();
  }

  return (
    <div className="p-6" data-testid="admin-aisles">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Aisles</p>
      <h1 className="text-2xl font-bold mt-1 text-zinc-900">Draw Aisles</h1>
      <p className="text-zinc-600 mt-1 text-sm">Click + drag on the floor plan to define aisle zones. These are used for proximity targeting and navigation labels.</p>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-6">
        <div className="h-[calc(100vh-220px)] min-h-[500px] rounded-xl border border-zinc-200 bg-zinc-100 overflow-hidden">
          {fp ? (
            <TransformWrapper minScale={0.5} maxScale={4} panning={{ disabled: !!drag }} wheel={{ step: 0.15 }}>
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
                <div
                  ref={stageRef}
                  onMouseDown={onDown}
                  onMouseMove={onMove}
                  onMouseUp={onUp}
                  onMouseLeave={() => setDrag(null)}
                  className="relative select-none"
                  style={{ width: "min(100%, 1400px)", aspectRatio: `${fp.width}/${fp.height}`, cursor: "crosshair" }}
                  data-testid="aisle-canvas"
                >
                  <img src={fp.image_base64} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${fp.width} ${fp.height}`} preserveAspectRatio="none">
                    {aisles.map((a) => (
                      <g key={a.id}>
                        <rect x={Math.min(a.x1, a.x2)} y={Math.min(a.y1, a.y2)} width={Math.abs(a.x2 - a.x1)} height={Math.abs(a.y2 - a.y1)} fill={a.color || "#0055FF"} fillOpacity="0.15" stroke={a.color || "#0055FF"} strokeWidth="2" strokeDasharray="6 4" />
                        <text x={(a.x1 + a.x2) / 2} y={(a.y1 + a.y2) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(14, fp.width * 0.012)} fontFamily="Outfit" fontWeight="600" fill="#0A0A0A">{a.name}</text>
                      </g>
                    ))}
                    {drag && (
                      <rect x={Math.min(drag.x1, drag.x2)} y={Math.min(drag.y1, drag.y2)} width={Math.abs(drag.x2 - drag.x1)} height={Math.abs(drag.y2 - drag.y1)} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" strokeDasharray="6 4" />
                    )}
                  </svg>
                </div>
              </TransformComponent>
            </TransformWrapper>
          ) : (
            <div className="w-full h-full grid place-items-center text-zinc-500">Upload a floor plan first</div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900">Aisle Properties</h3>
              <div className="space-y-3 mt-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="aisle-name-input" />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" data-testid="aisle-color-input" />
                </div>
                <p className="text-xs text-zinc-500">Drag on the map to draw a rectangular aisle zone with the current properties.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900">Aisles ({aisles.length})</h3>
              <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                {aisles.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-zinc-50" data-testid={`aisle-list-${a.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ background: a.color }} />
                      <span className="font-medium text-zinc-900">{a.name}</span>
                    </div>
                    <button onClick={() => remove(a.id)} className="text-red-500 hover:text-red-700" data-testid={`delete-aisle-${a.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {aisles.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No aisles drawn yet</p>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
