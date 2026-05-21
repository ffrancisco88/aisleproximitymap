import React, { useEffect, useRef, useState } from "react";
import { FloorPlans } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminFloorPlan() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("My Store");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  async function reload() {
    setList(await FloorPlans.list());
  }
  useEffect(() => { reload(); }, []);

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      const img = new Image();
      img.onload = () => {
        setWidth(img.naturalWidth);
        setHeight(img.naturalHeight);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  }

  async function upload() {
    if (!preview) return toast.error("Choose an image first");
    try {
      await FloorPlans.create({ name, image_base64: preview, width, height });
      toast.success("Floor plan uploaded and activated");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      reload();
    } catch (e) {
      toast.error("Upload failed");
    }
  }

  async function activate(id) {
    await FloorPlans.activate(id);
    toast.success("Activated");
    reload();
  }
  async function remove(id) {
    if (!confirm("Delete floor plan and all related data?")) return;
    await FloorPlans.remove(id);
    toast.success("Deleted");
    reload();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto" data-testid="admin-floorplan">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Floor Plan</p>
      <h1 className="text-3xl font-bold mt-2 text-zinc-900">Upload Floor Plan</h1>
      <p className="text-zinc-600 mt-1 text-sm">Upload a PNG/JPG of your store layout. The image dimensions become your logical coordinate system.</p>

      <Card className="mt-6 border-zinc-200">
        <CardContent className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="fp-name">Plan name</Label>
              <Input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="floorplan-name-input" />
            </div>
            <div>
              <Label htmlFor="fp-file">Floor plan image</Label>
              <Input id="fp-file" type="file" accept="image/*" ref={fileRef} onChange={onFile} data-testid="floorplan-file-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Width (px)</Label>
                <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} data-testid="floorplan-width" />
              </div>
              <div>
                <Label>Height (px)</Label>
                <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} data-testid="floorplan-height" />
              </div>
            </div>
            <Button onClick={upload} className="bg-zinc-900 hover:bg-zinc-800 w-full" data-testid="floorplan-upload-btn">
              <Upload className="w-4 h-4 mr-2" /> Upload & Activate
            </Button>
          </div>
          <div className="aspect-[4/3] rounded-xl border border-zinc-200 bg-zinc-100 flex items-center justify-center overflow-hidden" data-testid="floorplan-preview">
            {preview ? (
              <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center px-6">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Preview</p>
                <p className="text-zinc-700 mt-1 text-sm">Choose an image to preview</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold text-zinc-900 mt-10">Saved Plans</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {list.map((fp) => (
          <Card key={fp.id} className="border-zinc-200 overflow-hidden" data-testid={`floorplan-card-${fp.id}`}>
            <div className="aspect-[4/3] bg-zinc-100">
              <img src={fp.image_base64} className="w-full h-full object-contain" alt={fp.name} />
            </div>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{fp.name}</p>
                  <p className="text-xs text-zinc-500">{Math.round(fp.width)}×{Math.round(fp.height)}</p>
                </div>
                {fp.is_active ? (
                  <Badge className="bg-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => activate(fp.id)} data-testid={`activate-${fp.id}`}>Activate</Button>
                )}
              </div>
              <Button size="sm" variant="ghost" className="mt-3 text-red-600 hover:text-red-700" onClick={() => remove(fp.id)} data-testid={`delete-${fp.id}`}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && (
          <div className="col-span-full text-sm text-zinc-500 text-center py-12 border border-dashed border-zinc-300 rounded-xl">
            No floor plans yet
          </div>
        )}
      </div>
    </div>
  );
}
