"""Backend tests for ProximityMap AI - indoor navigation + proximity marketing."""
import os
import math
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend .env
ENV_PATH = Path("/app/frontend/.env")
BASE_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL not found"

API = f"{BASE_URL}/api"

TINY_PNG_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


def _has_id_leak(obj):
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_has_id_leak(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_id_leak(i) for i in obj)
    return False


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def floorplan(session):
    r = session.post(f"{API}/floorplans", json={
        "name": "TEST_Plan_Main", "image_base64": TINY_PNG_B64,
        "width": 1000, "height": 800
    })
    assert r.status_code == 200, r.text
    fp = r.json()
    yield fp
    session.delete(f"{API}/floorplans/{fp['id']}")


@pytest.fixture(scope="module")
def beacons(session, floorplan):
    """4 beacons at corners (100,100),(900,100),(100,700),(900,700)."""
    corners = [
        ("Beacon A", "AA:AA:AA:AA:AA:01", 100, 100),
        ("Beacon B", "AA:AA:AA:AA:AA:02", 900, 100),
        ("Beacon C", "AA:AA:AA:AA:AA:03", 100, 700),
        ("Beacon D", "AA:AA:AA:AA:AA:04", 900, 700),
    ]
    created = []
    for label, mac, x, y in corners:
        r = session.post(f"{API}/beacons", json={
            "floorplan_id": floorplan["id"], "label": label,
            "ble_mac": mac, "x": x, "y": y, "tx_power": -59
        })
        assert r.status_code == 200, r.text
        created.append(r.json())
    return created


# ----- Health -----
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_stats(self, session):
        r = session.get(f"{API}/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("floorplans", "beacons", "aisles", "products", "online_beacons"):
            assert k in d and isinstance(d[k], int)


# ----- Floorplans -----
class TestFloorplans:
    def test_create_and_active(self, session):
        # Create first
        r1 = session.post(f"{API}/floorplans", json={
            "name": "TEST_FP_1", "image_base64": TINY_PNG_B64,
            "width": 500, "height": 400
        })
        assert r1.status_code == 200
        fp1 = r1.json()
        assert fp1["is_active"] is True
        assert not _has_id_leak(fp1)

        # Create second - should deactivate first
        r2 = session.post(f"{API}/floorplans", json={
            "name": "TEST_FP_2", "image_base64": TINY_PNG_B64,
            "width": 500, "height": 400
        })
        assert r2.status_code == 200
        fp2 = r2.json()
        assert fp2["is_active"] is True

        # Active endpoint returns fp2
        ra = session.get(f"{API}/floorplans/active")
        assert ra.status_code == 200
        active = ra.json()
        assert active["id"] == fp2["id"]
        assert not _has_id_leak(active)

        # Activate fp1
        rac = session.post(f"{API}/floorplans/{fp1['id']}/activate")
        assert rac.status_code == 200
        ra2 = session.get(f"{API}/floorplans/active")
        assert ra2.json()["id"] == fp1["id"]

        # List - no _id leak
        rl = session.get(f"{API}/floorplans")
        assert rl.status_code == 200
        assert not _has_id_leak(rl.json())

        # Cleanup
        session.delete(f"{API}/floorplans/{fp1['id']}")
        session.delete(f"{API}/floorplans/{fp2['id']}")

    def test_cascade_delete(self, session):
        # Make a floorplan with a beacon, aisle, product
        fp = session.post(f"{API}/floorplans", json={
            "name": "TEST_Cascade", "image_base64": TINY_PNG_B64,
        }).json()
        fp_id = fp["id"]
        b = session.post(f"{API}/beacons", json={
            "floorplan_id": fp_id, "label": "CC", "ble_mac": "CC:CC:CC:CC:CC:CC",
            "x": 10, "y": 10
        }).json()
        a = session.post(f"{API}/aisles", json={
            "floorplan_id": fp_id, "name": "A1", "x1": 0, "y1": 0, "x2": 50, "y2": 50
        }).json()
        p = session.post(f"{API}/products", json={
            "floorplan_id": fp_id, "name": "P1", "x": 20, "y": 20
        }).json()

        # Delete floorplan
        rd = session.delete(f"{API}/floorplans/{fp_id}")
        assert rd.status_code == 200

        # Verify cascade
        assert len(session.get(f"{API}/beacons?floorplan_id={fp_id}").json()) == 0
        assert len(session.get(f"{API}/aisles?floorplan_id={fp_id}").json()) == 0
        assert len(session.get(f"{API}/products?floorplan_id={fp_id}").json()) == 0


# ----- Beacons -----
class TestBeacons:
    def test_list_filter_no_idleak(self, session, floorplan, beacons):
        r = session.get(f"{API}/beacons?floorplan_id={floorplan['id']}")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 4
        assert not _has_id_leak(items)
        for b in items:
            assert "online" in b

    def test_heartbeat_marks_online(self, session, beacons):
        mac = beacons[0]["ble_mac"]
        r = session.post(f"{API}/beacons/heartbeat", json={"ble_mac": mac})
        assert r.status_code == 200
        d = r.json()
        assert d["matched"] == 1
        assert d["modified"] == 1

        # Fetch beacon - should be online
        fp_id = beacons[0]["floorplan_id"]
        items = session.get(f"{API}/beacons?floorplan_id={fp_id}").json()
        b = next(x for x in items if x["id"] == beacons[0]["id"])
        assert b["online"] is True
        assert b["last_heartbeat"] is not None

    def test_heartbeat_no_mac_400(self, session):
        r = session.post(f"{API}/beacons/heartbeat", json={})
        assert r.status_code == 400

    def test_update_beacon(self, session, beacons):
        bid = beacons[1]["id"]
        r = session.put(f"{API}/beacons/{bid}", json={"label": "Beacon B Updated", "tx_power": -65})
        assert r.status_code == 200
        d = r.json()
        assert d["label"] == "Beacon B Updated"
        assert d["tx_power"] == -65

    def test_delete_beacon(self, session, floorplan):
        # Create then delete
        r = session.post(f"{API}/beacons", json={
            "floorplan_id": floorplan["id"], "label": "TEMP",
            "ble_mac": "EE:EE:EE:EE:EE:EE", "x": 1, "y": 1
        })
        bid = r.json()["id"]
        rd = session.delete(f"{API}/beacons/{bid}")
        assert rd.status_code == 200
        items = session.get(f"{API}/beacons?floorplan_id={floorplan['id']}").json()
        assert not any(x["id"] == bid for x in items)


# ----- Aisles -----
class TestAisles:
    def test_create_list_delete(self, session, floorplan):
        r = session.post(f"{API}/aisles", json={
            "floorplan_id": floorplan["id"], "name": "TEST_Aisle1",
            "x1": 100, "y1": 100, "x2": 400, "y2": 200, "color": "#FF0000"
        })
        assert r.status_code == 200
        a = r.json()
        assert a["name"] == "TEST_Aisle1"
        assert a["color"] == "#FF0000"

        rl = session.get(f"{API}/aisles?floorplan_id={floorplan['id']}")
        assert rl.status_code == 200
        assert not _has_id_leak(rl.json())
        assert any(x["id"] == a["id"] for x in rl.json())

        rd = session.delete(f"{API}/aisles/{a['id']}")
        assert rd.status_code == 200


# ----- Products -----
class TestProducts:
    def test_crud_and_search(self, session, floorplan):
        r = session.post(f"{API}/products", json={
            "floorplan_id": floorplan["id"], "name": "TEST_Milk",
            "price": 3.5, "discount_percent": 10,
            "promo_text": "Fresh!", "x": 200, "y": 200, "proximity_radius": 60
        })
        assert r.status_code == 200
        p = r.json()
        assert p["name"] == "TEST_Milk"
        assert p["price"] == 3.5
        assert p["discount_percent"] == 10
        assert not _has_id_leak(p)

        # Search
        rs = session.get(f"{API}/products?floorplan_id={floorplan['id']}&search=milk")
        assert rs.status_code == 200
        results = rs.json()
        assert any(x["id"] == p["id"] for x in results)
        assert not _has_id_leak(results)

        # Update
        ru = session.put(f"{API}/products/{p['id']}", json={"price": 4.0, "promo_text": "Save big"})
        assert ru.status_code == 200
        assert ru.json()["price"] == 4.0
        assert ru.json()["promo_text"] == "Save big"

        # Delete
        rd = session.delete(f"{API}/products/{p['id']}")
        assert rd.status_code == 200


# ----- Positioning -----
class TestPositioning:
    def test_scan_bias_toward_strong_beacon(self, session, floorplan, beacons):
        """Strong RSSI on beacon A at (100,100) should bias position toward (100,100)."""
        readings = [
            {"mac": beacons[0]["ble_mac"], "rssi": -45, "source": "ble"},  # A strong
            {"mac": beacons[1]["ble_mac"], "rssi": -85, "source": "ble"},  # B weak
            {"mac": beacons[2]["ble_mac"], "rssi": -85, "source": "ble"},  # C weak
            {"mac": beacons[3]["ble_mac"], "rssi": -90, "source": "ble"},  # D weak
        ]
        r = session.post(f"{API}/positioning/scan", json={
            "floorplan_id": floorplan["id"], "readings": readings
        })
        assert r.status_code == 200, r.text
        pos = r.json()
        assert pos["contributing"] == 4
        # Position should be closer to (100,100) than to (900,700)
        d_to_a = math.hypot(pos["x"] - 100, pos["y"] - 100)
        d_to_d = math.hypot(pos["x"] - 900, pos["y"] - 700)
        assert d_to_a < d_to_d, f"Got pos={pos}; should be biased toward A(100,100)"

    def test_scan_no_matching_beacons_400(self, session, floorplan):
        r = session.post(f"{API}/positioning/scan", json={
            "floorplan_id": floorplan["id"],
            "readings": [{"mac": "ZZ:ZZ:ZZ:ZZ:ZZ:ZZ", "rssi": -50, "source": "ble"}]
        })
        assert r.status_code == 400


# ----- Proximity -----
class TestProximity:
    def test_proximity_returns_sorted(self, session, floorplan):
        # Create 3 products, query position near one
        p1 = session.post(f"{API}/products", json={
            "floorplan_id": floorplan["id"], "name": "PROX_Near", "x": 500, "y": 500,
            "proximity_radius": 100
        }).json()
        p2 = session.post(f"{API}/products", json={
            "floorplan_id": floorplan["id"], "name": "PROX_Mid", "x": 540, "y": 500,
            "proximity_radius": 100
        }).json()
        p3 = session.post(f"{API}/products", json={
            "floorplan_id": floorplan["id"], "name": "PROX_Far", "x": 800, "y": 800,
            "proximity_radius": 30
        }).json()

        r = session.get(f"{API}/proximity?floorplan_id={floorplan['id']}&x=500&y=500")
        assert r.status_code == 200
        nearby = r.json()["nearby"]
        names = [n["name"] for n in nearby]
        assert "PROX_Near" in names
        assert "PROX_Mid" in names
        assert "PROX_Far" not in names  # out of its radius
        # Sorted by distance
        dists = [n["distance"] for n in nearby]
        assert dists == sorted(dists)
        assert not _has_id_leak(nearby)

        # cleanup
        for pid in (p1["id"], p2["id"], p3["id"]):
            session.delete(f"{API}/products/{pid}")


# ----- Routing -----
class TestRouting:
    def test_routing_returns_waypoints_and_steps(self, session, floorplan):
        p = session.post(f"{API}/products", json={
            "floorplan_id": floorplan["id"], "name": "ROUTE_Target",
            "x": 800, "y": 600
        }).json()
        r = session.post(f"{API}/routing", json={
            "floorplan_id": floorplan["id"], "from_x": 50, "from_y": 50,
            "product_id": p["id"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert "waypoints" in d and "steps" in d and "target" in d
        wps = d["waypoints"]
        assert len(wps) >= 2
        # First waypoint near from (within one cell ~ 20)
        assert math.hypot(wps[0]["x"] - 50, wps[0]["y"] - 50) < 40
        # Last waypoint near product
        assert math.hypot(wps[-1]["x"] - 800, wps[-1]["y"] - 600) < 40
        assert d["target"]["x"] == 800 and d["target"]["y"] == 600
        # Steps last says arrived
        assert d["steps"][-1]["instruction"].lower().startswith("you have arrived")

        session.delete(f"{API}/products/{p['id']}")

    def test_routing_invalid_product(self, session, floorplan):
        r = session.post(f"{API}/routing", json={
            "floorplan_id": floorplan["id"], "from_x": 0, "from_y": 0,
            "product_id": "nonexistent"
        })
        assert r.status_code == 404
