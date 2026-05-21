/*
 * ProximityMap AI - ESP32-S3 Beacon (v2)
 * Compatible with Arduino IDE 2.3.x and ESP32 Arduino Core 2.0.14 / 3.x
 *
 *  WHAT THIS DOES
 *   - Advertises as an iBeacon (so the backend can compute position via RSSI)
 *   - Uses CONNECTABLE advertising with the device NAME in the scan-response,
 *     so any smartphone BLE scanner (nRF Connect, LightBlue, BLE Scanner)
 *     will see "PMAI-Beacon-1", "PMAI-Beacon-2", etc.
 *   - Starts a Wi-Fi SoftAP "ESP32_BEACON_A" so phones can also see Wi-Fi side
 *   - Joins your home/store Wi-Fi (STA) and posts a heartbeat to the backend
 *     every 10 seconds so the admin dashboard shows the beacon as "Online".
 *
 *  BOARD SETUP IN ARDUINO IDE 2.3.x
 *   1. File -> Preferences -> "Additional boards manager URLs":
 *        https://espressif.github.io/arduino-esp32/package_esp32_index.json
 *   2. Tools -> Board -> Boards Manager -> search "esp32" by Espressif Systems
 *      -> Install (any version >= 2.0.14 works; 3.0.x recommended)
 *   3. Tools -> Board -> ESP32 Arduino -> "ESP32S3 Dev Module"
 *   4. Tools -> USB CDC On Boot -> "Enabled"  <-- so Serial.print works over USB
 *   5. Tools -> Port -> select the COM port of your ESP32-S3
 *
 *  WHAT TO EDIT (per board)
 *   - BEACON_ID    : 1 for the first board, 2 for the second, 3, 4
 *   - STA_SSID     : your Wi-Fi network name
 *   - STA_PASS     : your Wi-Fi password
 *   - BACKEND_HOST : the LAN IP of the Windows 10 PC that runs the backend
 *                    (run `ipconfig` on your PC and use the IPv4 of your
 *                     Wi-Fi or Ethernet adapter, NOT 127.0.0.1)
 *
 *  AFTER FLASHING
 *   - Open Serial Monitor at 115200 baud.
 *   - You will see: BLE MAC, Wi-Fi MAC, and "Heartbeat -> 200"
 *   - Open Bluetooth scanner on your phone -> you should see PMAI-Beacon-X
 *   - Open http://<PC-IP>:3000/admin/beacons and paste the printed MACs.
 *
 * 
 *
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLEAdvertising.h>
#include <BLEBeacon.h>

// ===================== EDIT THESE =====================
#define BEACON_ID         4                          // 1, 2, 3 or 4 - unique per board
const char* STA_SSID    = "GFiber_3DA68";          // your Wi-Fi
const char* STA_PASS    = "2hWpWPeT";      // your Wi-Fi password
const char* BACKEND_HOST = "192.168.254.152";           // your Windows 10 PC LAN IP
const uint16_t BACKEND_PORT = 8001;                  // backend port
// ======================================================

// iBeacon proximity UUID (keep the same across your 4 beacons; major = BEACON_ID)
const char* BEACON_UUID = "8ec76ea3-6668-48da-9866-75be8bc86f4d";

BLEAdvertising* pAdvertising = nullptr;
char deviceName[32];

void setupBLEBeacon() {
  snprintf(deviceName, sizeof(deviceName), "ESP32_BEACON_D-%d", BEACON_ID);

  BLEDevice::init(deviceName);

  // Creating a dummy GATT server makes us appear as a "Connectable" device
  // which most consumer phone BLE scanners (including built-in Android
  // Bluetooth menu) need in order to display the device.
  BLEServer* pServer = BLEDevice::createServer();
  (void)pServer; // we don't expose any services, just need to be connectable

  pAdvertising = BLEDevice::getAdvertising();

  // ---------- Build the iBeacon manufacturer data ----------
  BLEBeacon beacon;
  beacon.setManufacturerId(0x004C);                 // Apple's company ID (iBeacon)
  beacon.setProximityUUID(BLEUUID(BEACON_UUID));
  beacon.setMajor(BEACON_ID);
  beacon.setMinor(1);
  beacon.setSignalPower(-59);                       // measured RSSI at 1 metre

  // The full advertising payload (29 bytes max). We put iBeacon data here.
  // BLEAdvertisementData advData;
  // advData.setFlags(0x06);                           // BR/EDR not supported, general discoverable
  // std::string md;
  // md += (char)0x4C; md += (char)0x00;               // company ID little-endian
  // std::string raw = beacon.getData();
  // md.append(raw);
  // advData.setManufacturerData(md);
  // pAdvertising->setAdvertisementData(advData);


  BLEAdvertisementData advData;
advData.setFlags(0x06);

String md = "";
md += (char)0x4C;
md += (char)0x00;

String raw = beacon.getData();
md += raw;

advData.setManufacturerData(md);

pAdvertising->setAdvertisementData(advData);

  // The scan-response carries the human-readable NAME so phones can SEE us.
  BLEAdvertisementData scanResp;
  scanResp.setName(deviceName);
  pAdvertising->setScanResponseData(scanResp);

  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);

  BLEDevice::startAdvertising();

  Serial.print("BLE advertising as: ");
  Serial.println(deviceName);
  Serial.print("BLE MAC: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
}

void setupWiFi() {
  char apSsid[24];
  snprintf(apSsid, sizeof(apSsid), "ESP32_BEACON_%c", 'A' + BEACON_ID - 1);

  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(apSsid, "12345678");
  Serial.print("SoftAP started: ");
  Serial.print(apSsid);
  Serial.print(" / IP: ");
  Serial.println(WiFi.softAPIP());

  WiFi.begin(STA_SSID, STA_PASS);
  Serial.print("Joining ");
  Serial.print(STA_SSID);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("STA IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WARN: STA not connected - heartbeat will be skipped.");
  }
  Serial.print("Wi-Fi MAC: ");
  Serial.println(WiFi.macAddress());
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/beacons/heartbeat";

  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(4000);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String bleMac = BLEDevice::getAddress().toString().c_str();
  String wifiMac = WiFi.macAddress();

  String body = "{\"ble_mac\":\"" + bleMac + "\",\"wifi_mac\":\"" + wifiMac + "\"}";
  int code = http.POST(body);
  Serial.printf("Heartbeat -> %d  url=%s\n", code, url.c_str());
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.printf("=== ProximityMap AI Beacon #%d boot ===\n", BEACON_ID);

  setupBLEBeacon();
  setupWiFi();
}

void loop() {
  static unsigned long lastHb = 0;
  if (millis() - lastHb > 10000) {
    lastHb = millis();
    sendHeartbeat();
  }
  delay(100);
}
