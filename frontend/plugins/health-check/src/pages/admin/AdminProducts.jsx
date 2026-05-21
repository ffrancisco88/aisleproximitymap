import React, { useEffect, useState } from "react";
import { FloorPlans, Aisles, Products } from "@/lib/api";
import InteractiveMap from "@/components/InteractiveMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_IMG = "https://images.unsplash.com/photo-1606824722920-4c652a70f348?crop=entropy&cs=srgb&fm=jpg&w=400&q=85";

export default function AdminProducts() {
  const [fp, setFp] = useState(null);
  const [aisles, setAisles] = useState([]);
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", aisle_id: "", image_url: DEFAULT_IMG, price: 9.99, discount_percent: 20, promo_text: "Save 20% today only!", proximity_radius: 80,
  });

  async function reload() {
    const a = await FloorPlans.active();
    setFp(a);
    if (a) {
      setAisles(await Aisles.list(a.id));
      setProducts(await Products.list(a.id));
    }
  }
  useEffect(() => { reload(); }, []);

  function onMapClick(x, y) { setDraft({ x, y }); }

  async function save() {
    if (!fp || !draft) return toast.error("Click on the map to place product first");
    if (!form.name) return toast.error("Name required");
    try {
      await Products.create({
        floorplan_id: fp.id,
        ...form,
        aisle_id: form.aisle_id || null,
        price: Number(form.price),
        discount_percent: Number(form.discount_percent),
        proximity_radius: Number(form.proximity_radius),
        x: draft.x,
        y: draft.y,
      });
      toast.success(`${form.name} added`);
      setDraft(null);
      setForm({ ...form, name: "" });
      reload();
    } catch (e) {
      toast.error("Failed to save product");
    }
  }

  async function remove(id) {
    await Products.remove(id);
    toast.success("Removed");
    reload();
  }

  return (
    <div className="p-6" data-testid="admin-products">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Products</p>
      <h1 className="text-2xl font-bold mt-1 text-zinc-900">Products & Promos</h1>
      <p className="text-zinc-600 mt-1 text-sm">Click the map to place a product. Set proximity radius — when a customer enters that radius, they get a promo popup.</p>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 mt-6">
        <div className="h-[calc(100vh-220px)] min-h-[500px]">
          <InteractiveMap
            floorplan={fp}
            aisles={aisles}
            products={products}
            onMapClick={onMapClick}
            interactive
            overlay={
              draft && fp && (
                <div
                  className="absolute pointer-events-none w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-dashed border-orange-500 bg-orange-200/40 animate-pulse z-30"
                  style={{ left: `${(draft.x / fp.width) * 100}%`, top: `${(draft.y / fp.height) * 100}%` }}
                  data-testid="draft-product-marker"
                />
              )
            }
          />
        </div>

        <div className="space-y-4">
          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900">{draft ? "New Product" : "Click map to place"}</h3>
              <div className="space-y-3 mt-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Organic Milk 1L" data-testid="product-name-input" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="product-desc-input" />
                </div>
                <div>
                  <Label>Aisle</Label>
                  <Select value={form.aisle_id || "none"} onValueChange={(v) => setForm({ ...form, aisle_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="product-aisle-select"><SelectValue placeholder="Choose aisle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {aisles.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Price</Label>
                    <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="product-price-input" />
                  </div>
                  <div>
                    <Label>Discount %</Label>
                    <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} data-testid="product-discount-input" />
                  </div>
                </div>
                <div>
                  <Label>Promo Message</Label>
                  <Input value={form.promo_text} onChange={(e) => setForm({ ...form, promo_text: e.target.value })} data-testid="product-promo-input" />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} data-testid="product-image-input" />
                </div>
                <div>
                  <Label>Proximity Radius (logical units): {form.proximity_radius}</Label>
                  <Input type="range" min="30" max="200" value={form.proximity_radius} onChange={(e) => setForm({ ...form, proximity_radius: e.target.value })} data-testid="product-radius-input" />
                </div>
                <Button onClick={save} className="bg-zinc-900 hover:bg-zinc-800 w-full" data-testid="product-save-btn">
                  <Plus className="w-4 h-4 mr-2" /> Save Product
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200">
            <CardContent className="p-5">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Products ({products.length})
              </h3>
              <ul className="mt-3 space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-zinc-50" data-testid={`product-list-${p.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={p.image_url || DEFAULT_IMG} alt="" className="w-8 h-8 rounded object-cover bg-zinc-100" />
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-zinc-500">${p.price} · {p.discount_percent}% off</p>
                      </div>
                    </div>
                    <button onClick={() => remove(p.id)} className="text-red-500 hover:text-red-700" data-testid={`delete-product-${p.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
                {products.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No products yet</p>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
