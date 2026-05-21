import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ARDUINO_SKETCH = `/*
 * ProximityMap AI - ESP32-S3 Beacon
 * Combines BLE iBeacon advertising + Wi-Fi SoftAP + heartbeat POST.
 *
 * REQUIRES:
 *  - ESP32 Arduino core 2.0.14 or newer (Tools > Board > Boards Manager: "esp32" by Espressif)
 *  - Select board: "ESP32S3 Dev Module"
 *
 * EDIT the 3 values below for each of your 4 beacons:
 *   BEACON_ID  (1..4)
 *   BACKEND_HOST  (your Windows 10 PC LAN IP, e.g. 192.168.1.50)
 *   STA_SSID/STA_PASS  (your home/store Wi-Fi to reach the backend)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEAdvertising.h>
#include <BLEBeacon.h>

#define BEACON_ID         1
const char* STA_SSID    = "YOUR_WIFI_SSID";
const char* STA_PASS    = "YOUR_WIFI_PASSWORD";
const char* BACKEND_HOST = "192.168.1.50";   // your Windows 10 PC LAN IP
const uint16_t BACKEND_PORT = 8001;

// iBeacon parameters (you can change these to a custom UUID if you like)
const char* BEACON_UUID = "8ec76ea3-6668-48da-9866-75be8bc86f4d";

BLEAdvertising* pAdvertising;

void setupBLEBeacon() {
  String name = String("PMAI-Beacon-") + BEACON_ID;
  BLEDevice::init(name.c_str());
  pAdvertising = BLEDevice::getAdvertising();
  BLEBeacon beacon;
  beacon.setManufacturerId(0x4C00);
  beacon.setProximityUUID(BLEUUID(BEACON_UUID));
  beacon.setMajor(BEACON_ID);
  beacon.setMinor(1);
  beacon.setSignalPower(-59);
  BLEAdvertisementData adData;
  adData.setFlags(0x04);
  adData.setManufacturerData(std::string((char*)beacon.getData().data(), beacon.getData().length()));
  pAdvertising->setAdvertisementData(adData);
  pAdvertising->setScanResponseData(adData);
  pAdvertising->setAdvertisementType(ADV_TYPE_NONCONN_IND);
  pAdvertising->start();
}

void setupWiFiSoftAP() {
  String ssid = String("ESP32_BEACON_") + (char)('A' + BEACON_ID - 1);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(ssid.c_str(), "12345678");
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/beacons/heartbeat";
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  String mac = WiFi.macAddress();
  String body = String("{\\"ble_mac\\":\\"") + BLEDevice::getAddress().toString().c_str() +
                "\\",\\"wifi_mac\\":\\"" + mac + "\\"}";
  int code = http.POST(body);
  Serial.printf("Heartbeat -> %d\\n", code);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  setupBLEBeacon();
  setupWiFiSoftAP();

  WiFi.begin(STA_SSID, STA_PASS);
  Serial.print("Connecting WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 30) {
    delay(500); Serial.print("."); tries++;
  }
  Serial.println();
  Serial.print("IP: "); Serial.println(WiFi.localIP());
  Serial.print("BLE MAC: "); Serial.println(BLEDevice::getAddress().toString().c_str());
  Serial.print("WiFi MAC: "); Serial.println(WiFi.macAddress());
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last > 10000) {
    last = millis();
    sendHeartbeat();
  }
  delay(100);
}
`;

const WINDOWS_SETUP_MD = `# Windows 10 Local Setup

## 0. Requirements
- Windows 10 (or 11) with admin access
- 4 × ESP32-S3 boards
- Arduino IDE (already installed)
- Your phone + your PC on the **same Wi-Fi network**

## 1. Install MongoDB Community Server
1. Download MongoDB Community Server from \`https://www.mongodb.com/try/download/community\`
2. Run the installer. Choose "Complete". Install as a Service.
3. Verify it's running: \`Win + R\` → \`services.msc\` → look for **MongoDB Server**.

## 2. Install Python 3.11+
1. Download from \`https://www.python.org/downloads/windows/\`
2. During install, check "**Add Python to PATH**".

## 3. Install Node.js 20+
1. Download LTS from \`https://nodejs.org/\`
2. After install: open PowerShell → \`npm install -g yarn\`

## 4. Get the project
\`\`\`powershell
git clone <YOUR_REPO_URL> proximitymap
cd proximitymap
\`\`\`
> Or just copy the \`/app\` folder from this Emergent project to your PC.

## 5. Configure backend env
Create \`backend/.env\`:
\`\`\`
MONGO_URL=mongodb://localhost:27017
DB_NAME=proximitymap
CORS_ORIGINS=*
\`\`\`

## 6. Start backend
\`\`\`powershell
cd backend
python -m venv .venv
.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
\`\`\`
Backend will be at \`http://<YOUR_PC_LAN_IP>:8001\` (find IP with \`ipconfig\`).

## 7. Configure frontend env
Create \`frontend/.env\`:
\`\`\`
REACT_APP_BACKEND_URL=http://<YOUR_PC_LAN_IP>:8001
\`\`\`

## 8. Start frontend
\`\`\`powershell
cd ..\\frontend
yarn install
yarn start
\`\`\`
- Open \`http://<YOUR_PC_LAN_IP>:3000\` from your phone on the same Wi-Fi.

## 9. Allow inbound traffic on Windows Firewall
\`\`\`powershell
New-NetFirewallRule -DisplayName "ProximityMap Backend" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
New-NetFirewallRule -DisplayName "ProximityMap Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
\`\`\`

## 10. Flash the ESP32-S3 boards
1. Open the **ESP32_S3_Beacon.ino** sketch (download from this page).
2. In Arduino IDE:
   - Tools → Board → \`ESP32S3 Dev Module\`
   - Tools → USB CDC On Boot → \`Enabled\`
   - Tools → Port → COMx of your board
3. Edit at the top of the sketch:
   - \`BEACON_ID\` → 1, 2, 3, or 4 (one per device)
   - \`BACKEND_HOST\` → your PC's LAN IP
   - \`STA_SSID\` and \`STA_PASS\` → your Wi-Fi credentials
4. **Upload**. Open Serial Monitor @ 115200 baud — copy the **BLE MAC** and **WiFi MAC** printed at boot.

## 11. Register the beacons in the Admin
1. Browser → \`http://localhost:3000/admin/floorplan\` → upload your floor plan PNG/JPG.
2. → \`/admin/beacons\` → click each corner of the store and paste the printed BLE+WiFi MAC.
3. → \`/admin/aisles\` → drag to draw aisle zones.
4. → \`/admin/products\` → click product locations, set price + discount + promo text.

## 12. Test on phone
1. On your phone: open Chrome → \`http://<YOUR_PC_LAN_IP>:3000/customer\`
2. (Optional) Enable Web Bluetooth scanning:  
   \`chrome://flags/#enable-experimental-web-platform-features\` → Enable → relaunch Chrome.
3. Tap **Locate**, grant Bluetooth permission. Walk around → your dot moves.
4. Or tap **simulate mode** on the map to test routing & promos without walking.

## 13. Troubleshooting
- **Phone can't reach backend**: confirm both on same Wi-Fi, check Windows Firewall rules.
- **No BLE in Chrome**: requires Android Chrome with experimental flag. Use simulate mode otherwise.
- **Beacons never go online**: check Serial Monitor; ensure \`BACKEND_HOST\` IP is right and reachable (ping from ESP32 not possible — try \`curl\` from phone).
`;

function CodeBlock({ code, lang = "" }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied");
  };
  return (
    <div className="relative group">
      <pre className="bg-zinc-900 text-zinc-100 text-xs leading-relaxed rounded-xl p-4 overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
      <button onClick={copy} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-2 py-1 rounded flex items-center gap-1" data-testid="copy-code-btn">
        <Copy className="w-3 h-3" /> Copy
      </button>
    </div>
  );
}

export default function AdminSetup() {
  function downloadSketch() {
    const blob = new Blob([ARDUINO_SKETCH], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ESP32_S3_Beacon.ino";
    a.click(); URL.revokeObjectURL(url);
    toast.success("Sketch downloaded");
  }

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="admin-setup">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 font-bold">Admin · Setup</p>
      <h1 className="text-3xl font-bold mt-2 text-zinc-900">Windows 10 + Arduino IDE Setup</h1>
      <p className="text-zinc-600 mt-1 text-sm">Step-by-step guide to run ProximityMap AI locally with your 4× ESP32-S3 beacons.</p>

      <div className="mt-6 flex gap-3 flex-wrap">
        <Button onClick={downloadSketch} className="bg-zinc-900 hover:bg-zinc-800" data-testid="download-sketch-btn">
          <Download className="w-4 h-4 mr-2" /> Download ESP32_S3_Beacon.ino
        </Button>
      </div>

      <Tabs defaultValue="windows" className="mt-8">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="windows" data-testid="tab-windows">Windows 10</TabsTrigger>
          <TabsTrigger value="arduino" data-testid="tab-arduino">Arduino Sketch</TabsTrigger>
          <TabsTrigger value="esp32" data-testid="tab-esp32">ESP32 Board</TabsTrigger>
        </TabsList>

        <TabsContent value="windows" className="space-y-4 mt-4">
          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">1. Install dependencies</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> <span><a className="text-[#0055FF] underline" href="https://www.mongodb.com/try/download/community" target="_blank" rel="noreferrer">MongoDB Community Server</a> — install as Windows service</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> <span><a className="text-[#0055FF] underline" href="https://www.python.org/downloads/windows/" target="_blank" rel="noreferrer">Python 3.11+</a> — check "Add to PATH"</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" /> <span><a className="text-[#0055FF] underline" href="https://nodejs.org/" target="_blank" rel="noreferrer">Node.js LTS 20+</a> + <code className="bg-zinc-100 px-1 rounded">npm i -g yarn</code></span></li>
            </ul>
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">2. Start backend</h3>
            <CodeBlock code={`cd backend
python -m venv .venv
.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001`} />
            <p className="text-xs text-zinc-500 mt-2">Find your PC's LAN IP with <code className="bg-zinc-100 px-1 rounded">ipconfig</code> — you'll need it for the ESP32 sketch and frontend env.</p>
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">3. Start frontend</h3>
            <p className="text-sm text-zinc-700 mb-2">Create <code className="bg-zinc-100 px-1 rounded">frontend/.env</code>:</p>
            <CodeBlock code={`REACT_APP_BACKEND_URL=http://<YOUR_PC_LAN_IP>:8001`} />
            <CodeBlock code={`cd frontend
yarn install
yarn start`} />
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">4. Open firewall ports</h3>
            <CodeBlock code={`New-NetFirewallRule -DisplayName "ProximityMap Backend"  -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
New-NetFirewallRule -DisplayName "ProximityMap Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow`} />
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">5. Open on phone</h3>
            <p className="text-sm text-zinc-700">Make sure your phone is on the same Wi-Fi, then open Chrome:</p>
            <CodeBlock code={`http://<YOUR_PC_LAN_IP>:3000/customer`} />
            <p className="text-xs text-zinc-500 mt-2">For BLE scanning, enable Chrome flag <code className="bg-zinc-100 px-1 rounded">chrome://flags/#enable-experimental-web-platform-features</code>.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="arduino" className="space-y-4 mt-4">
          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">Arduino IDE — ESP32 Board Manager</h3>
            <p className="text-sm text-zinc-700 mt-2">In Arduino IDE → File → Preferences → "Additional boards manager URLs":</p>
            <CodeBlock code={`https://espressif.github.io/arduino-esp32/package_esp32_index.json`} />
            <p className="text-sm text-zinc-700 mt-3">Then Tools → Board → Boards Manager → search <strong>esp32</strong> by Espressif → Install (v2.0.14+).</p>
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">ESP32_S3_Beacon.ino</h3>
            <p className="text-sm text-zinc-700 mt-1">Combines BLE iBeacon + Wi-Fi SoftAP + heartbeat POST to backend.</p>
            <div className="mt-3">
              <CodeBlock code={ARDUINO_SKETCH} />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="esp32" className="space-y-4 mt-4">
          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">Per-board configuration</h3>
            <p className="text-sm text-zinc-700">For each of your 4 ESP32-S3 boards:</p>
            <ol className="mt-3 space-y-2 text-sm text-zinc-700 list-decimal list-inside">
              <li>Set <code className="bg-zinc-100 px-1 rounded">BEACON_ID</code> to 1, 2, 3 or 4 — must be unique per board.</li>
              <li>Set <code className="bg-zinc-100 px-1 rounded">BACKEND_HOST</code> to your Windows 10 PC LAN IP.</li>
              <li>Set <code className="bg-zinc-100 px-1 rounded">STA_SSID</code> + <code className="bg-zinc-100 px-1 rounded">STA_PASS</code> to your Wi-Fi.</li>
              <li>Tools → Board → <strong>ESP32S3 Dev Module</strong>. Set USB CDC On Boot = Enabled.</li>
              <li>Upload. Open Serial Monitor @ 115200 — copy the <strong>BLE MAC</strong> and <strong>WiFi MAC</strong>.</li>
              <li>In Admin → Beacons → click corner on map → paste MACs.</li>
            </ol>
          </CardContent></Card>

          <Card className="border-zinc-200"><CardContent className="p-6">
            <h3 className="font-semibold text-zinc-900 text-lg">Placement tips for ~2–3m accuracy</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700 list-disc list-inside">
              <li>Place all 4 beacons at the same height (~2m, above shelves).</li>
              <li>Spread them to the 4 corners — wider triangulation = better accuracy.</li>
              <li>Avoid metal racks blocking line-of-sight to RF.</li>
              <li>Keep ESP32 powered via USB or a 5V supply; battery decay shifts RSSI calibration.</li>
              <li>If accuracy drifts, calibrate <code className="bg-zinc-100 px-1 rounded">tx_power</code> in the admin (measured RSSI at 1m).</li>
            </ul>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card className="border-zinc-200 mt-8"><CardContent className="p-6">
        <h3 className="font-semibold text-zinc-900 text-lg">Full setup README</h3>
        <CodeBlock code={WINDOWS_SETUP_MD} />
      </CardContent></Card>
    </div>
  );
}
