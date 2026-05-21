from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import heapq
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal, Tuple
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ProximityMap AI API")
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============== MODELS ==============

class FloorPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    image_base64: str  # data URL
    width: float = 1000  # logical units (meters * 10) or pixels
    height: float = 700
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)


class FloorPlanCreate(BaseModel):
    name: str
    image_base64: str
    width: float = 1000
    height: float = 700


class Beacon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    floorplan_id: str
    label: str  # e.g. "Beacon A"
    ble_mac: Optional[str] = None  # e.g. "AA:BB:CC:DD:EE:FF"
    wifi_mac: Optional[str] = None
    ssid: Optional[str] = None  # SoftAP SSID for Wi-Fi mode
    tx_power: int = -59  # measured RSSI at 1m
    x: float
    y: float
    last_heartbeat: Optional[str] = None
    online: bool = False
    created_at: str = Field(default_factory=now_iso)


class BeaconCreate(BaseModel):
    floorplan_id: str
    label: str
    ble_mac: Optional[str] = None
    wifi_mac: Optional[str] = None
    ssid: Optional[str] = None
    tx_power: int = -59
    x: float
    y: float


class BeaconUpdate(BaseModel):
    label: Optional[str] = None
    ble_mac: Optional[str] = None
    wifi_mac: Optional[str] = None
    ssid: Optional[str] = None
    tx_power: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None


class BeaconHeartbeat(BaseModel):
    ble_mac: Optional[str] = None
    wifi_mac: Optional[str] = None
    rssi_sample: Optional[int] = None


class Aisle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    floorplan_id: str
    name: str
    x1: float
    y1: float
    x2: float
    y2: float
    color: str = "#0055FF"
    created_at: str = Field(default_factory=now_iso)


class AisleCreate(BaseModel):
    floorplan_id: str
    name: str
    x1: float
    y1: float
    x2: float
    y2: float
    color: str = "#0055FF"


class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    floorplan_id: str
    name: str
    description: Optional[str] = ""
    aisle_id: Optional[str] = None
    image_url: Optional[str] = None
    price: float = 0.0
    discount_percent: float = 0.0
    promo_text: Optional[str] = ""
    x: float  # product location on floor
    y: float
    proximity_radius: float = 80  # in logical units
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    floorplan_id: str
    name: str
    description: Optional[str] = ""
    aisle_id: Optional[str] = None
    image_url: Optional[str] = None
    price: float = 0.0
    discount_percent: float = 0.0
    promo_text: Optional[str] = ""
    x: float
    y: float
    proximity_radius: float = 80


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    aisle_id: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    discount_percent: Optional[float] = None
    promo_text: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    proximity_radius: Optional[float] = None


class ScanReading(BaseModel):
    beacon_id: Optional[str] = None
    mac: Optional[str] = None
    rssi: int
    source: Literal["ble", "wifi"] = "ble"


class ScanRequest(BaseModel):
    floorplan_id: str
    readings: List[ScanReading]


class Position(BaseModel):
    x: float
    y: float
    accuracy: float
    contributing: int


class RouteRequest(BaseModel):
    floorplan_id: str
    from_x: float
    from_y: float
    product_id: str


# ============== HELPERS ==============

def rssi_to_distance(rssi: int, tx_power: int = -59, n: float = 2.5) -> float:
    """Log-distance path-loss model. Returns logical units (we scale to floor plan)."""
    if rssi == 0:
        return 9999.0
    ratio = (tx_power - rssi) / (10.0 * n)
    return math.pow(10.0, ratio) * 50.0  # scale: 1 meter ~= 50 logical units


def weighted_centroid(points: List[Tuple[float, float, float]]) -> Tuple[float, float, float]:
    """points: list of (x, y, weight)"""
    if not points:
        return (0, 0, 0)
    total_w = sum(p[2] for p in points)
    if total_w <= 0:
        return (0, 0, 0)
    cx = sum(p[0] * p[2] for p in points) / total_w
    cy = sum(p[1] * p[2] for p in points) / total_w
    spread = sum(p[2] * math.hypot(p[0] - cx, p[1] - cy) for p in points) / total_w
    return (cx, cy, spread)


# ============== ROUTES ==============

@api_router.get("/")
async def root():
    return {"name": "ProximityMap AI API", "status": "ok"}


# ---------- Floor Plans ----------

@api_router.post("/floorplans", response_model=FloorPlan)
async def create_floorplan(input: FloorPlanCreate):
    # Deactivate previous active plan
    await db.floorplans.update_many({"is_active": True}, {"$set": {"is_active": False}})
    fp = FloorPlan(**input.model_dump(), is_active=True)
    await db.floorplans.insert_one(fp.model_dump())
    return fp


@api_router.get("/floorplans", response_model=List[FloorPlan])
async def list_floorplans():
    items = await db.floorplans.find({}, {"_id": 0}).to_list(100)
    return items


@api_router.get("/floorplans/active", response_model=Optional[FloorPlan])
async def get_active_floorplan():
    item = await db.floorplans.find_one({"is_active": True}, {"_id": 0})
    return item


@api_router.get("/floorplans/{fp_id}", response_model=FloorPlan)
async def get_floorplan(fp_id: str):
    item = await db.floorplans.find_one({"id": fp_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Floor plan not found")
    return item


@api_router.post("/floorplans/{fp_id}/activate")
async def activate_floorplan(fp_id: str):
    await db.floorplans.update_many({"is_active": True}, {"$set": {"is_active": False}})
    res = await db.floorplans.update_one({"id": fp_id}, {"$set": {"is_active": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api_router.delete("/floorplans/{fp_id}")
async def delete_floorplan(fp_id: str):
    await db.floorplans.delete_one({"id": fp_id})
    await db.beacons.delete_many({"floorplan_id": fp_id})
    await db.aisles.delete_many({"floorplan_id": fp_id})
    await db.products.delete_many({"floorplan_id": fp_id})
    return {"ok": True}


# ---------- Beacons ----------

@api_router.post("/beacons", response_model=Beacon)
async def create_beacon(input: BeaconCreate):
    b = Beacon(**input.model_dump())
    await db.beacons.insert_one(b.model_dump())
    return b


@api_router.get("/beacons", response_model=List[Beacon])
async def list_beacons(floorplan_id: Optional[str] = None):
    q = {"floorplan_id": floorplan_id} if floorplan_id else {}
    items = await db.beacons.find(q, {"_id": 0}).to_list(500)
    # auto-mark offline if no heartbeat in 30s
    nowts = datetime.now(timezone.utc)
    for it in items:
        if it.get("last_heartbeat"):
            try:
                ts = datetime.fromisoformat(it["last_heartbeat"])
                it["online"] = (nowts - ts).total_seconds() < 30
            except Exception:
                it["online"] = False
        else:
            it["online"] = False
    return items


@api_router.put("/beacons/{b_id}", response_model=Beacon)
async def update_beacon(b_id: str, upd: BeaconUpdate):
    update_doc = {k: v for k, v in upd.model_dump().items() if v is not None}
    if not update_doc:
        raise HTTPException(400, "No fields to update")
    await db.beacons.update_one({"id": b_id}, {"$set": update_doc})
    item = await db.beacons.find_one({"id": b_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Beacon not found")
    return item


@api_router.delete("/beacons/{b_id}")
async def delete_beacon(b_id: str):
    await db.beacons.delete_one({"id": b_id})
    return {"ok": True}


@api_router.post("/beacons/heartbeat")
async def beacon_heartbeat(hb: BeaconHeartbeat):
    """Called by ESP32-S3 device or a companion script periodically."""
    q = {}
    if hb.ble_mac:
        q["ble_mac"] = hb.ble_mac.upper()
    elif hb.wifi_mac:
        q["wifi_mac"] = hb.wifi_mac.upper()
    else:
        raise HTTPException(400, "Provide ble_mac or wifi_mac")
    res = await db.beacons.update_one(
        q, {"$set": {"last_heartbeat": now_iso(), "online": True}}
    )
    return {"matched": res.matched_count, "modified": res.modified_count}


# ---------- Aisles ----------

@api_router.post("/aisles", response_model=Aisle)
async def create_aisle(input: AisleCreate):
    a = Aisle(**input.model_dump())
    await db.aisles.insert_one(a.model_dump())
    return a


@api_router.get("/aisles", response_model=List[Aisle])
async def list_aisles(floorplan_id: Optional[str] = None):
    q = {"floorplan_id": floorplan_id} if floorplan_id else {}
    return await db.aisles.find(q, {"_id": 0}).to_list(500)


@api_router.delete("/aisles/{a_id}")
async def delete_aisle(a_id: str):
    await db.aisles.delete_one({"id": a_id})
    return {"ok": True}


# ---------- Products ----------

@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate):
    p = Product(**input.model_dump())
    await db.products.insert_one(p.model_dump())
    return p


@api_router.get("/products", response_model=List[Product])
async def list_products(floorplan_id: Optional[str] = None, search: Optional[str] = None):
    q = {}
    if floorplan_id:
        q["floorplan_id"] = floorplan_id
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    return await db.products.find(q, {"_id": 0}).to_list(2000)


@api_router.get("/products/{p_id}", response_model=Product)
async def get_product(p_id: str):
    item = await db.products.find_one({"id": p_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Product not found")
    return item


@api_router.put("/products/{p_id}", response_model=Product)
async def update_product(p_id: str, upd: ProductUpdate):
    update_doc = {k: v for k, v in upd.model_dump().items() if v is not None}
    if update_doc:
        await db.products.update_one({"id": p_id}, {"$set": update_doc})
    item = await db.products.find_one({"id": p_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Product not found")
    return item


@api_router.delete("/products/{p_id}")
async def delete_product(p_id: str):
    await db.products.delete_one({"id": p_id})
    return {"ok": True}


# ---------- Positioning ----------

@api_router.post("/positioning/scan", response_model=Position)
async def positioning_scan(req: ScanRequest):
    """Compute current position from RSSI readings via weighted centroid (multilateration approximation)."""
    beacons = await db.beacons.find({"floorplan_id": req.floorplan_id}, {"_id": 0}).to_list(500)
    bmap = {b["id"]: b for b in beacons}
    bmap_ble = {(b.get("ble_mac") or "").upper(): b for b in beacons if b.get("ble_mac")}
    bmap_wifi = {(b.get("wifi_mac") or "").upper(): b for b in beacons if b.get("wifi_mac")}

    points = []
    for r in req.readings:
        b = None
        if r.beacon_id and r.beacon_id in bmap:
            b = bmap[r.beacon_id]
        # elif r.mac:
        #    mac = r.mac.upper()
        #    b = bmap_ble.get(mac) or bmap_wifi.get(mac)

        elif r.mac:
            mac = r.mac.upper()

            b = (
                bmap_ble.get(mac)
                or bmap_wifi.get(mac)
                or next(
                    (
                        x for x in beacons
                        if (x.get("ssid") or "").upper() == mac
                    ),
                    None
                )
            ) 
            
        if not b:
            continue
        # path-loss exponent: BLE 2.0, WiFi 3.0 (more attenuation indoors)
        n = 2.0 if r.source == "ble" else 3.0
        dist = rssi_to_distance(r.rssi, b.get("tx_power", -59), n)
        # weight: closer reads contribute more. Weight = 1 / (dist^2 + 1)
        w = 1.0 / (dist * dist + 1.0)
        # weight WiFi slightly less than BLE for indoor
        if r.source == "wifi":
            w *= 0.6
        points.append((b["x"], b["y"], w))

    if not points:
        raise HTTPException(400, "No matching beacons found for the readings")

    cx, cy, spread = weighted_centroid(points)
    return Position(x=cx, y=cy, accuracy=spread, contributing=len(points))


# ---------- Proximity ----------

@api_router.get("/proximity")
async def proximity_check(floorplan_id: str, x: float, y: float):
    products = await db.products.find({"floorplan_id": floorplan_id}, {"_id": 0}).to_list(2000)
    nearby = []
    for p in products:
        d = math.hypot(p["x"] - x, p["y"] - y)
        if d <= p.get("proximity_radius", 80):
            p["distance"] = d
            nearby.append(p)
    nearby.sort(key=lambda x: x["distance"])
    return {"nearby": nearby}


# ---------- Routing ----------

def build_grid(width: float, height: float, aisles: List[dict], cell: float = 20.0):
    cols = max(1, int(width // cell))
    rows = max(1, int(height // cell))
    blocked = [[False] * cols for _ in range(rows)]
    # Treat aisle shelves (rectangles) as semi-passable: pathway is around aisles.
    # Mark aisle interiors as walkable; do not block. Walls would need separate input.
    return cols, rows, blocked, cell


def astar(start, goal, cols, rows, blocked):
    def h(a, b):
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    gscore = {start: 0}
    while open_set:
        _, cur = heapq.heappop(open_set)
        if cur == goal:
            path = [cur]
            while cur in came_from:
                cur = came_from[cur]
                path.append(cur)
            path.reverse()
            return path
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]:
            nx, ny = cur[0] + dx, cur[1] + dy
            if not (0 <= nx < cols and 0 <= ny < rows):
                continue
            if blocked[ny][nx]:
                continue
            step = 1.4 if dx and dy else 1.0
            tentative = gscore[cur] + step
            if tentative < gscore.get((nx, ny), 1e9):
                came_from[(nx, ny)] = cur
                gscore[(nx, ny)] = tentative
                f = tentative + h((nx, ny), goal)
                heapq.heappush(open_set, (f, (nx, ny)))
    return [start, goal]


def simplify_path(path):
    """Keep only direction-change points to produce turn waypoints."""
    if len(path) < 3:
        return path
    out = [path[0]]
    for i in range(1, len(path) - 1):
        ax, ay = path[i - 1]
        bx, by = path[i]
        cx, cy = path[i + 1]
        if (bx - ax, by - ay) != (cx - bx, cy - by):
            out.append(path[i])
    out.append(path[-1])
    return out


def turn_instructions(waypoints):
    if len(waypoints) < 2:
        return []
    steps = []
    for i in range(1, len(waypoints)):
        ax, ay = waypoints[i - 1]
        bx, by = waypoints[i]
        dx, dy = bx - ax, by - ay
        dist = math.hypot(dx, dy)
        angle = math.degrees(math.atan2(dy, dx))
        # 0=east, 90=south, -90=north, 180=west (screen coords with y down)
        direction = "forward"
        if -45 <= angle <= 45:
            direction = "head east"
        elif 45 < angle <= 135:
            direction = "head south"
        elif -135 <= angle < -45:
            direction = "head north"
        else:
            direction = "head west"
        steps.append({"instruction": f"{direction.title()} for ~{int(dist)} units", "x": bx, "y": by})
    if steps:
        steps[-1]["instruction"] = "You have arrived at the product"
    return steps


@api_router.post("/routing")
async def routing(req: RouteRequest):
    fp = await db.floorplans.find_one({"id": req.floorplan_id}, {"_id": 0})
    if not fp:
        raise HTTPException(404, "Floor plan not found")
    product = await db.products.find_one({"id": req.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Product not found")
    aisles = await db.aisles.find({"floorplan_id": req.floorplan_id}, {"_id": 0}).to_list(500)
    cell = 20.0
    cols, rows, blocked, cell = build_grid(fp["width"], fp["height"], aisles, cell)
    sx = max(0, min(cols - 1, int(req.from_x // cell)))
    sy = max(0, min(rows - 1, int(req.from_y // cell)))
    gx = max(0, min(cols - 1, int(product["x"] // cell)))
    gy = max(0, min(rows - 1, int(product["y"] // cell)))
    path = astar((sx, sy), (gx, gy), cols, rows, blocked)
    waypoints = [(x * cell + cell / 2, y * cell + cell / 2) for (x, y) in path]
    waypoints = simplify_path(waypoints)
    steps = turn_instructions(waypoints)
    return {
        "waypoints": [{"x": x, "y": y} for x, y in waypoints],
        "steps": steps,
        "target": {"x": product["x"], "y": product["y"], "name": product["name"]},
    }


# ---------- Stats ----------

@api_router.get("/stats")
async def stats():
    return {
        "floorplans": await db.floorplans.count_documents({}),
        "beacons": await db.beacons.count_documents({}),
        "aisles": await db.aisles.count_documents({}),
        "products": await db.products.count_documents({}),
        "online_beacons": await db.beacons.count_documents({"online": True}),
    }


# ---------- Demo Seed ----------

DEMO_FLOORPLAN_SVG = """<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'>
  <rect width='1200' height='800' fill='#fafafa'/>
  <rect x='40' y='40' width='1120' height='720' fill='#ffffff' stroke='#27272a' stroke-width='6'/>
  <rect x='540' y='728' width='120' height='44' fill='#e4e4e7' stroke='#27272a' stroke-width='2'/>
  <text x='600' y='756' font-family='Arial' font-size='14' fill='#52525B' text-anchor='middle' font-weight='600'>ENTRANCE</text>
  <g fill='#e4e4e7' stroke='#a1a1aa' stroke-width='1'>
    <rect x='100' y='110' width='280' height='50'/>
    <rect x='100' y='220' width='280' height='50'/>
    <rect x='100' y='330' width='280' height='50'/>
    <rect x='100' y='440' width='280' height='50'/>
    <rect x='460' y='110' width='280' height='50'/>
    <rect x='460' y='220' width='280' height='50'/>
    <rect x='460' y='330' width='280' height='50'/>
    <rect x='460' y='440' width='280' height='50'/>
    <rect x='820' y='110' width='280' height='50'/>
    <rect x='820' y='220' width='280' height='50'/>
    <rect x='820' y='330' width='280' height='50'/>
    <rect x='820' y='440' width='280' height='50'/>
  </g>
  <g fill='#fef3c7' stroke='#f59e0b' stroke-width='2'>
    <rect x='200' y='590' width='100' height='50'/>
    <rect x='360' y='590' width='100' height='50'/>
    <rect x='520' y='590' width='100' height='50'/>
    <rect x='680' y='590' width='100' height='50'/>
    <rect x='840' y='590' width='100' height='50'/>
  </g>
  <g font-family='Arial' font-size='11' fill='#92400e' text-anchor='middle' font-weight='600'>
    <text x='250' y='620'>Checkout 1</text>
    <text x='410' y='620'>Checkout 2</text>
    <text x='570' y='620'>Checkout 3</text>
    <text x='730' y='620'>Checkout 4</text>
    <text x='890' y='620'>Checkout 5</text>
  </g>
  <text x='600' y='80' font-family='Arial' font-size='20' fill='#0a0a0a' text-anchor='middle' font-weight='800' letter-spacing='4'>DEMO SUPERMARKET</text>
</svg>"""


def demo_image_data_url() -> str:
    import base64
    b64 = base64.b64encode(DEMO_FLOORPLAN_SVG.strip().encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{b64}"


@api_router.post("/seed/reset")
async def seed_reset():
    await db.floorplans.delete_many({})
    await db.beacons.delete_many({})
    await db.aisles.delete_many({})
    await db.products.delete_many({})
    return {"ok": True, "message": "All data cleared"}


@api_router.post("/seed/demo")
async def seed_demo():
    """Populate MongoDB with a demo supermarket: 1 floor plan, 4 beacons, 8 aisles, 12 products with promos."""
    # Clear first to keep it idempotent
    await db.floorplans.delete_many({})
    await db.beacons.delete_many({})
    await db.aisles.delete_many({})
    await db.products.delete_many({})

    fp = FloorPlan(
        name="Demo Supermarket",
        image_base64=demo_image_data_url(),
        width=1200,
        height=800,
        is_active=True,
    )
    await db.floorplans.insert_one(fp.model_dump())

    beacons_data = [
        ("Beacon A", "AA:BB:CC:DD:EE:01", "11:22:33:44:55:01", "ESP32_BEACON_A", 80, 80),
        ("Beacon B", "AA:BB:CC:DD:EE:02", "11:22:33:44:55:02", "ESP32_BEACON_B", 1120, 80),
        ("Beacon C", "AA:BB:CC:DD:EE:03", "11:22:33:44:55:03", "ESP32_BEACON_C", 1120, 720),
        ("Beacon D", "AA:BB:CC:DD:EE:04", "11:22:33:44:55:04", "ESP32_BEACON_D", 80, 720),
    ]
    for label, ble, wifi, ssid, x, y in beacons_data:
        b = Beacon(floorplan_id=fp.id, label=label, ble_mac=ble, wifi_mac=wifi, ssid=ssid, tx_power=-59, x=x, y=y)
        await db.beacons.insert_one(b.model_dump())

    aisles_data = [
        ("Dairy", 100, 110, 380, 160, "#0055FF"),
        ("Snacks", 460, 110, 740, 160, "#10B981"),
        ("Personal Care", 820, 110, 1100, 160, "#F59E0B"),
        ("Produce", 100, 220, 380, 270, "#10B981"),
        ("Beverages", 460, 220, 740, 270, "#0055FF"),
        ("Electronics", 820, 220, 1100, 270, "#8B5CF6"),
        ("Bakery", 100, 330, 380, 380, "#F59E0B"),
        ("Canned Goods", 460, 330, 740, 380, "#0055FF"),
    ]
    aisle_ids = {}
    for name, x1, y1, x2, y2, color in aisles_data:
        a = Aisle(floorplan_id=fp.id, name=name, x1=x1, y1=y1, x2=x2, y2=y2, color=color)
        await db.aisles.insert_one(a.model_dump())
        aisle_ids[name] = a.id

    img = lambda u: f"https://images.unsplash.com/{u}?crop=entropy&cs=srgb&fm=jpg&w=400&q=85"  # noqa: E731

    products_data = [
        ("Organic Whole Milk 1L", "Fresh dairy from local farms", "Dairy", 240, 135, 3.99, 20, "Save 20% today!", img("photo-1550583724-b2692b85b150")),
        ("Greek Yogurt 500g", "High protein, low sugar", "Dairy", 320, 135, 4.49, 15, "15% off member promo", img("photo-1488477181946-6428a0291777")),
        ("Potato Chips Family Pack", "Sea salt & vinegar", "Snacks", 540, 135, 5.99, 25, "Buy 1 get 1 25% off", img("photo-1566478989037-eec170784d0b")),
        ("Chocolate Cookies", "Belgian dark chocolate chip", "Snacks", 660, 135, 4.29, 30, "Flash sale - 30% off!", img("photo-1499636136210-6f4ee915583e")),
        ("Shampoo 500ml", "Argan oil & keratin", "Personal Care", 900, 135, 8.99, 10, "10% off this week", img("photo-1556228720-195a672e8a03")),
        ("Toothpaste Triple Pack", "Whitening + cavity protection", "Personal Care", 1020, 135, 12.49, 20, "20% off bundle deal", img("photo-1559591937-abc3a5b1d6e0")),
        ("Organic Bananas", "Fairtrade certified", "Produce", 240, 245, 2.49, 0, "Fresh today", img("photo-1571771894821-ce9b6c11b08e")),
        ("Avocados Pack of 4", "Ready to eat", "Produce", 320, 245, 5.99, 15, "15% off ripe & ready", img("photo-1523049673857-eb18f1d7b578")),
        ("Sparkling Water 6-Pack", "Lemon & lime", "Beverages", 540, 245, 4.99, 10, "10% off cases", img("photo-1564890369478-c89ca6d9cde9")),
        ("Cold Brew Coffee 1L", "Smooth, dark roast", "Beverages", 660, 245, 6.79, 25, "Try it - 25% off intro", img("photo-1517701604599-bb29b565090c")),
        ("Wireless Earbuds", "Active noise cancelling", "Electronics", 900, 245, 79.99, 30, "Mega Deal - 30% off!", img("photo-1606220945770-b5b6c2c55bf1")),
        ("USB-C Charger 65W", "Fast charge any laptop", "Electronics", 1020, 245, 39.99, 20, "20% off accessories", img("photo-1583394838336-acd977736f90")),
    ]
    for name, desc, aisle_name, x, y, price, discount, promo, image in products_data:
        p = Product(
            floorplan_id=fp.id,
            name=name,
            description=desc,
            aisle_id=aisle_ids.get(aisle_name),
            image_url=image,
            price=price,
            discount_percent=discount,
            promo_text=promo,
            x=x,
            y=y,
            proximity_radius=70,
        )
        await db.products.insert_one(p.model_dump())

    return {
        "ok": True,
        "floorplan_id": fp.id,
        "counts": {
            "floorplans": 1,
            "beacons": len(beacons_data),
            "aisles": len(aisles_data),
            "products": len(products_data),
        },
    }


app.include_router(api_router)


# Serve the canonical Arduino .ino sketch as plain text so the admin "Download sketch"
# button always returns the latest version that lives in /app/arduino_sketches/.
@app.get("/api/sketch/ESP32_S3_Beacon.ino")
async def get_sketch():
    from fastapi.responses import PlainTextResponse
    sketch_path = ROOT_DIR.parent / "arduino_sketches" / "ESP32_S3_Beacon" / "ESP32_S3_Beacon.ino"
    if not sketch_path.exists():
        raise HTTPException(404, "Sketch file not found on server")
    return PlainTextResponse(
        sketch_path.read_text(encoding="utf-8"),
        media_type="text/plain; charset=utf-8",
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
