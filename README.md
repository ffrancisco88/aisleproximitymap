1. Install dependencies
MongoDB Community Server — install as Windows service
Python 3.11+ — check "Add to PATH"
Node.js LTS 20+ + npm i -g yarn
2. Start backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
Copy
Find your PC's LAN IP with ipconfig — you'll need it for the ESP32 sketch and frontend env.

3. Start frontend
Create frontend/.env:

REACT_APP_BACKEND_URL=http://<YOUR_PC_LAN_IP>:8001
Copy
cd frontend
yarn install
yarn start
Copy
4. Open firewall ports
New-NetFirewallRule -DisplayName "ProximityMap Backend"  -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
New-NetFirewallRule -DisplayName "ProximityMap Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
Copy
5. Open on phone
Make sure your phone is on the same Wi-Fi, then open Chrome:

http://<YOUR_PC_LAN_IP>:3000/customer
Copy
For BLE scanning, enable Chrome flag chrome://flags/#enable-experimental-web-platform-features.


==========================================================================
Full setup README
# Windows 10 Local Setup

## 0. Requirements
- Windows 10 (or 11) with admin access
- 4 × ESP32-S3 boards
- Arduino IDE (already installed)
- Your phone + your PC on the **same Wi-Fi network**

## 1. Install MongoDB Community Server
1. Download MongoDB Community Server from `https://www.mongodb.com/try/download/community`
2. Run the installer. Choose "Complete". Install as a Service.
3. Verify it's running: `Win + R` → `services.msc` → look for **MongoDB Server**.

## 2. Install Python 3.11+
1. Download from `https://www.python.org/downloads/windows/`
2. During install, check "**Add Python to PATH**".

## 3. Install Node.js 20+
1. Download LTS from `https://nodejs.org/`
2. After install: open PowerShell → `npm install -g yarn`

## 4. Get the project
```powershell
git clone <YOUR_REPO_URL> proximitymap
cd proximitymap
```
> Or just copy the `/app` folder from this project to your PC.

## 5. Configure backend env
Create `backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=proximitymap
CORS_ORIGINS=*
```

## 6. Start backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

Backend will be at `http://<YOUR_PC_LAN_IP>:8001` (find IP with `ipconfig`).

## 7. Configure frontend env
Create `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://<YOUR_PC_LAN_IP>:8001
```
//REACT_APP_BACKEND_URL=http://192.168.254.152:8001,
//GENERATE_SOURCEMAP=false 
## 8. Start frontend
```powershell
cd ..\frontend
yarn install
yarn start
```
- Open `http://<YOUR_PC_LAN_IP>:3000` from your phone on the same Wi-Fi.

## 9. Allow inbound traffic on Windows Firewall
```powershell
New-NetFirewallRule -DisplayName "ProximityMap Backend" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
New-NetFirewallRule -DisplayName "ProximityMap Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## 10. Flash the ESP32-S3 boards
1. Open the **ESP32_S3_Beacon.ino** sketch (download from this page).
2. In Arduino IDE:
   - Tools → Board → `ESP32S3 Dev Module`
   - Tools → USB CDC On Boot → `Enabled`
   - Tools → Port → COMx of your board
3. Edit at the top of the sketch:
   - `BEACON_ID` → 1, 2, 3, or 4 (one per device)
   - `BACKEND_HOST` → your PC's LAN IP
   - `STA_SSID` and `STA_PASS` → your Wi-Fi credentials
4. **Upload**. Open Serial Monitor @ 115200 baud — copy the **BLE MAC** and **WiFi MAC** printed at boot.

## 11. Register the beacons in the Admin
1. Browser → `http://localhost:3000/admin/floorplan` → upload your floor plan PNG/JPG.
2. → `/admin/beacons` → click each corner of the store and paste the printed BLE+WiFi MAC.
3. → `/admin/aisles` → drag to draw aisle zones.
4. → `/admin/products` → click product locations, set price + discount + promo text.

## 12. Test on phone
1. On your phone: open Chrome → `http://<YOUR_PC_LAN_IP>:3000/customer`
2. (Optional) Enable Web Bluetooth scanning:  
   `chrome://flags/#enable-experimental-web-platform-features` → Enable → relaunch Chrome.
3. Tap **Locate**, grant Bluetooth permission. Walk around → your dot moves.
4. Or tap **simulate mode** on the map to test routing & promos without walking.

## 13. Troubleshooting
- **Phone can't reach backend**: confirm both on same Wi-Fi, check Windows Firewall rules.
- **No BLE in Chrome**: requires Android Chrome with experimental flag. Use simulate mode otherwise.
- **Beacons never go online**: check Serial Monitor; ensure `BACKEND_HOST` IP is right and reachable (ping from ESP32 not possible — try `curl` from phone).



============ADDITIONAL GUIDE==========

## 1. Generate HTTPS certificates with mkcert

In Command Prompt (use **your** LAN IP):

```cmd
cd C:\aislefinder
mkdir certs
cd certs
mkcert 192.168.254.111 localhost 127.0.0.1
ren 192.168.254.111+2.pem cert.pem
ren 192.168.254.111+2-key.pem key.pem
```

You now have `C:\aislefinder\certs\cert.pem` and `key.pem`.

**Trust the cert on your Android phone:**
1. Email yourself `C:\Users\<you>\AppData\Local\mkcert\rootCA.pem` (or transfer via Drive).
2. On the phone: open the file → ** ** → **CA certificate**
   → confirm the warning.
3. Done — Chrome on Android now trusts your laptop's HTTPS.

=======================================================================

**Start the Backend
```
cd C:\inavigationprofinder\backend>
uvicorn server:app --host 0.0.0.0 --port 8001 --reload --ssl-certfile "C:\inavigationprofinder\certs\cert.pem" --ssl-keyfile "C:\inavigationprofinder\certs\key.pem"
``

**Start frontend
``
cd C:\inavigationprofinder\frontend>
yarn start
```




