#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>

// Backend Configuration
const char* backendUrl = "https://carwash-backend-5spn.onrender.com";

// WiFi Manager Configuration
const char* apSSID = "Wash Controller";
const char* apPassword = ""; // No password for easy access

// Relay Pin Configuration (Updated for ESP32 S3 with your pins)
const int relayPins[6] = {1, 2, 41, 42, 45, 46};
const int NUM_RELAYS = 6;
const int RELAY_TRIGGER_DURATION = 500; // 500ms as requested

// Web Server for local status/debugging and WiFi config
WebServer server(80);
DNSServer dnsServer;

// WiFi credentials storage
Preferences preferences;
String savedSSID = "";
String savedPassword = "";

// System states
bool isAccessPointMode = false;
bool isConfigMode = false;

// Timing variables
unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 3000; // Poll every 3 seconds (reduced for rate limiting)

// Relay states for status tracking
bool relayStates[NUM_RELAYS] = {false, false, false, false, false, false};
unsigned long relayTriggerTimes[NUM_RELAYS] = {0, 0, 0, 0, 0, 0};

// Command tracking for completion notifications
struct ActiveCommand {
  String id;
  int relayId;
  String source;
  bool notificationSent;
};
ActiveCommand activeCommands[NUM_RELAYS];

// Connection status
bool wifiConnected = false;
bool backendConnected = false;
unsigned long lastConnectionCheck = 0;
const unsigned long CONNECTION_CHECK_INTERVAL = 30000; // Check every 30 seconds

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Car Wash Controller Starting ===");
  
  // Initialize preferences
  preferences.begin("wifi-config", false);
  
  // Load saved WiFi credentials
  savedSSID = preferences.getString("ssid", "");
  savedPassword = preferences.getString("password", "");
  
  // Initialize relay pins
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], LOW); // Start with relays OFF (LOW = OFF for most relay modules)
    Serial.printf("Initialized relay %d on pin %d\n", i + 1, relayPins[i]);
    
    // Initialize active commands tracking
    activeCommands[i].id = "";
    activeCommands[i].relayId = 0;
    activeCommands[i].source = "";
    activeCommands[i].notificationSent = true;
  }
  
  // Attempt to connect to WiFi
  if (savedSSID.length() > 0) {
    Serial.printf("Attempting to connect to saved network: %s\n", savedSSID.c_str());
    connectToWiFi(savedSSID.c_str(), savedPassword.c_str());
  }
  
  // If WiFi connection failed, start access point mode
  if (!wifiConnected) {
    Serial.println("WiFi connection failed. Starting Access Point mode...");
    startAccessPoint();
  } else {
    // Setup normal web server for debugging
    setupWebServer();
  }
  
  Serial.println("Setup complete. Starting main loop...");
}

void loop() {
  // Handle web server requests
  server.handleClient();
  
  // Handle DNS requests in AP mode
  if (isAccessPointMode) {
    dnsServer.processNextRequest();
  }
  
  // Only do normal operations if connected to WiFi and not in config mode
  if (wifiConnected && !isConfigMode) {
    // Check WiFi connection periodically
    if (millis() - lastConnectionCheck >= CONNECTION_CHECK_INTERVAL) {
      checkConnections();
      lastConnectionCheck = millis();
    }
    
    // Poll backend for commands every second
    if (millis() - lastPollTime >= POLL_INTERVAL) {
      pollBackendForCommands();
      lastPollTime = millis();
    }
    
    // Check if any relays need to be turned off (after 500ms)
    checkRelayTimers();
  }
  
  // Small delay to prevent watchdog timeout
  delay(10);
}

void connectToWiFi(const char* ssid, const char* password) {
  Serial.printf("Connecting to WiFi: %s\n", ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    isAccessPointMode = false;
    isConfigMode = false;
    Serial.printf("\nWiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Backend URL: %s\n", backendUrl);
    
    // Setup normal web server
    setupWebServer();
  } else {
    wifiConnected = false;
    Serial.println("\nFailed to connect to WiFi");
  }
}

void startAccessPoint() {
  Serial.printf("Starting Access Point: %s\n", apSSID);
  
  // Stop any existing WiFi connection
  WiFi.disconnect();
  
  // Start Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSSID, apPassword);
  
  IPAddress apIP = WiFi.softAPIP();
  Serial.printf("Access Point started! IP: %s\n", apIP.toString().c_str());
  Serial.println("Connect to 'Wash Controller' network and visit http://192.168.4.1");
  
  isAccessPointMode = true;
  isConfigMode = true;
  
  // Setup DNS server for captive portal
  dnsServer.start(53, "*", apIP);
  
  // Setup WiFi configuration web server
  setupWiFiConfigServer();
}

void checkConnections() {
  // Check WiFi
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi disconnected. Attempting reconnection...");
    }
    wifiConnected = false;
    
    // Try to reconnect with saved credentials
    if (savedSSID.length() > 0) {
      connectToWiFi(savedSSID.c_str(), savedPassword.c_str());
    }
    
    // If still not connected, start AP mode
    if (!wifiConnected) {
      Serial.println("Reconnection failed. Starting Access Point mode...");
      startAccessPoint();
    }
  } else {
    wifiConnected = true;
  }
}

void pollBackendForCommands() {
  if (!wifiConnected || isConfigMode) {
    return;
  }
  
  HTTPClient http;
  String pollUrl = String(backendUrl) + "/api/trigger/poll";
  
  http.begin(pollUrl);
  http.setTimeout(5000); // 5 second timeout
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    
    // Parse JSON response
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      bool hasCommand = doc["hasCommand"] | false;
      
      if (hasCommand) {
        JsonObject command = doc["command"];
        int relayId = command["relayId"] | 0;
        String source = command["source"] | "unknown";
        String commandId = command["id"] | "unknown";
        
        Serial.printf("Received command: Relay %d from %s (ID: %s)\n", 
                     relayId, source.c_str(), commandId.c_str());
        
        // Trigger the relay with command tracking
        triggerRelayWithCommand(relayId, commandId, source);
        
        backendConnected = true;
      } else {
        // No commands - this is normal, don't spam the console
        backendConnected = true;
      }
    } else {
      Serial.printf("JSON parse error: %s\n", error.c_str());
      backendConnected = false;
    }
  } else if (httpCode == HTTP_CODE_NOT_FOUND) {
    // 404 - polling endpoint not found
    Serial.println("Backend polling endpoint not found (404)");
    backendConnected = false;
  } else if (httpCode > 0) {
    // Other HTTP error
    Serial.printf("HTTP error: %d\n", httpCode);
    backendConnected = false;
  } else {
    // Connection error
    if (backendConnected) {
      Serial.printf("Backend connection failed: %s\n", http.errorToString(httpCode).c_str());
    }
    backendConnected = false;
  }
  
  http.end();
}

void triggerRelayWithCommand(int relayId, String commandId, String source) {
  // Validate relay ID (1-6)
  if (relayId < 1 || relayId > NUM_RELAYS) {
    Serial.printf("Invalid relay ID: %d\n", relayId);
    sendCompletionNotification(commandId, relayId, source, false, "Invalid relay ID");
    return;
  }
  
  int relayIndex = relayId - 1; // Convert to 0-based index
  int pin = relayPins[relayIndex];
  
  // Store command info for completion notification
  activeCommands[relayIndex].id = commandId;
  activeCommands[relayIndex].relayId = relayId;
  activeCommands[relayIndex].source = source;
  activeCommands[relayIndex].notificationSent = false;
  
  // Turn ON relay
  digitalWrite(pin, HIGH);
  relayStates[relayIndex] = true;
  relayTriggerTimes[relayIndex] = millis();
  
  String actionDesc = (source == "reset") ? "RESET" : "WASH";
  Serial.printf("%s: Relay %d (pin %d) turned ON for %dms\n", actionDesc.c_str(), relayId, pin, RELAY_TRIGGER_DURATION);
}

void triggerRelay(int relayId) {
  // Legacy function for local testing
  triggerRelayWithCommand(relayId, "local_" + String(millis()), "local");
}

void checkRelayTimers() {
  unsigned long currentTime = millis();
  
  for (int i = 0; i < NUM_RELAYS; i++) {
    if (relayStates[i] && (currentTime - relayTriggerTimes[i] >= RELAY_TRIGGER_DURATION)) {
      // Time to turn off this relay
      digitalWrite(relayPins[i], LOW);
      relayStates[i] = false;
      
      String actionDesc = (activeCommands[i].source == "reset") ? "RESET" : "WASH";
      Serial.printf("%s COMPLETE: Relay %d (pin %d) turned OFF after %dms\n", 
                   actionDesc.c_str(), i + 1, relayPins[i], RELAY_TRIGGER_DURATION);
      
      // Send completion notification if we have command info and haven't sent it yet
      if (!activeCommands[i].notificationSent && activeCommands[i].id != "" && wifiConnected && !isConfigMode) {
        String message = actionDesc + " cycle completed successfully";
        sendCompletionNotification(activeCommands[i].id, activeCommands[i].relayId, 
                                 activeCommands[i].source, true, message);
        activeCommands[i].notificationSent = true;
      }
    }
  }
}

void sendCompletionNotification(String commandId, int relayId, String source, bool success, String message) {
  if (!wifiConnected || !backendConnected || isConfigMode) {
    Serial.printf("Cannot send completion notification - not connected (WiFi: %s, Backend: %s, ConfigMode: %s)\n", 
                 wifiConnected ? "OK" : "FAIL", backendConnected ? "OK" : "FAIL", isConfigMode ? "YES" : "NO");
    return;
  }
  
  HTTPClient http;
  String notificationUrl = String(backendUrl) + "/api/trigger/completed";
  
  http.begin(notificationUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["commandId"] = commandId;
  doc["relayId"] = relayId;
  doc["source"] = source;
  doc["success"] = success;
  doc["message"] = message;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpCode = http.POST(jsonString);
  
  if (httpCode == HTTP_CODE_OK) {
    Serial.printf("✅ Completion notification sent: Relay %d %s\n", relayId, success ? "SUCCESS" : "FAILED");
    
    // Parse response for any additional info
    String response = http.getString();
    DynamicJsonDocument responseDoc(256);
    if (deserializeJson(responseDoc, response) == DeserializationError::Ok) {
      String notification = responseDoc["notification"] | "";
      if (notification.length() > 0) {
        Serial.printf("📢 Backend notification: %s\n", notification.c_str());
      }
    }
  } else {
    Serial.printf("❌ Failed to send completion notification: HTTP %d\n", httpCode);
  }
  
  http.end();
}

void setupWiFiConfigServer() {
  // WiFi configuration page
  server.on("/", HTTP_GET, handleWiFiConfigPage);
  server.on("/", HTTP_POST, handleWiFiConfigSave);
  server.on("/scan", HTTP_GET, handleWiFiScan);
  server.on("/status", HTTP_GET, handleConfigStatus);
  server.on("/reset", HTTP_POST, handleConfigReset);
  
  // Captive portal - redirect all requests to config page
  server.onNotFound(handleWiFiConfigPage);
  
  server.begin();
  Serial.println("WiFi configuration server started");
}

void setupWebServer() {
  // Clear existing routes
  server.close();
  
  // Health check endpoint
  server.on("/", HTTP_GET, handleRoot);
  server.on("/ping", HTTP_GET, []() {
    server.send(200, "text/plain", "ESP32 Car Wash Controller - OK");
  });
  
  // System status endpoint
  server.on("/status", HTTP_GET, handleGetStatus);
  
  // Manual relay trigger (for local testing)
  server.on("/trigger", HTTP_POST, handleLocalTrigger);
  
  // Reset all relays
  server.on("/reset", HTTP_POST, handleReset);
  
  // WiFi configuration access (even when connected)
  server.on("/config", HTTP_GET, handleWiFiConfigPage);
  server.on("/config", HTTP_POST, handleWiFiConfigSave);
  server.on("/scan", HTTP_GET, handleWiFiScan);
  
  // 404 handler
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
  });
  
  server.begin();
  Serial.println("Local web server started on port 80");
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Wash Controller</title>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>";
  html += "body { font-family: Arial; margin: 20px; background: #f0f0f0; }";
  html += ".container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }";
  html += ".status { padding: 10px; margin: 10px 0; border-radius: 5px; }";
  html += ".online { background: #d4edda; color: #155724; }";
  html += ".offline { background: #f8d7da; color: #721c24; }";
  html += ".btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 5px; }";
  html += ".btn:hover { background: #0056b3; }";
  html += ".danger { background: #dc3545; }";
  html += ".danger:hover { background: #c82333; }";
  html += "</style></head><body>";
  html += "<div class=\"container\">";
  html += "<h1>Wash Controller</h1>";
  html += "<div class=\"status " + String(wifiConnected ? "online" : "offline") + "\">";
  html += "WiFi: " + String(wifiConnected ? "Connected" : "Disconnected");
  html += "</div>";
  html += "<div class=\"status " + String(backendConnected ? "online" : "offline") + "\">";
  html += "Backend: " + String(backendConnected ? "Connected" : "Disconnected");
  html += "</div>";
  html += "<p><strong>WiFi:</strong> " + WiFi.SSID() + "</p>";
  html += "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Backend:</strong> " + String(backendUrl) + "</p>";
  html += "<p><strong>Uptime:</strong> " + String(millis() / 1000) + " seconds</p>";
  html += "<h2>Actions</h2>";
  html += "<a href=\"/status\" class=\"btn\">System Status</a>";
  html += "<a href=\"/config\" class=\"btn\">WiFi Config</a>";
  html += "<a href=\"/scan\" class=\"btn\">Scan Networks</a>";
  html += "<h2>Danger Zone</h2>";
  html += "<form method=\"post\" action=\"/reset\" style=\"display: inline;\">";
  html += "<button type=\"submit\" class=\"btn danger\" onclick=\"return confirm('Reset all relays?')\">Reset All Relays</button>";
  html += "</form></div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleWiFiConfigPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>WiFi Configuration</title>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>";
  html += "body { font-family: Arial; margin: 0; padding: 20px; background: #f0f0f0; }";
  html += ".container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }";
  html += "h1 { color: #333; text-align: center; margin-bottom: 30px; }";
  html += ".form-group { margin-bottom: 20px; }";
  html += "label { display: block; margin-bottom: 5px; font-weight: bold; }";
  html += "input, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }";
  html += ".btn { background: #007bff; color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-size: 16px; }";
  html += ".btn:hover { background: #0056b3; }";
  html += ".btn-secondary { background: #6c757d; }";
  html += ".btn-secondary:hover { background: #545b62; }";
  html += ".status { padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center; }";
  html += ".info { background: #d1ecf1; color: #0c5460; }";
  html += ".success { background: #d4edda; color: #155724; }";
  html += ".network-list { max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 5px; }";
  html += ".network-item { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }";
  html += ".network-item:hover { background: #f8f9fa; }";
  html += ".network-item:last-child { border-bottom: none; }";
  html += ".signal-strength { float: right; }";
  html += "</style>";
  html += "<script>";
  html += "function selectNetwork(ssid) { document.getElementById('ssid').value = ssid; }";
  html += "function scanNetworks() {";
  html += "document.getElementById('scan-btn').innerText = 'Scanning...';";
  html += "fetch('/scan').then(response => response.json()).then(data => {";
  html += "const list = document.getElementById('network-list');";
  html += "list.innerHTML = '';";
  html += "data.networks.forEach(network => {";
  html += "const item = document.createElement('div');";
  html += "item.className = 'network-item';";
  html += "item.onclick = () => selectNetwork(network.ssid);";
  html += "item.innerHTML = network.ssid + ' <span class=\"signal-strength\">' + network.rssi + ' dBm</span>';";
  html += "list.appendChild(item);";
  html += "});";
  html += "document.getElementById('scan-btn').innerText = 'Scan Networks';";
  html += "}).catch(error => {";
  html += "console.error('Scan failed:', error);";
  html += "document.getElementById('scan-btn').innerText = 'Scan Failed';";
  html += "});";
  html += "}";
  html += "</script>";
  html += "</head><body>";
  html += "<div class=\"container\">";
  html += "<h1>Wash Controller WiFi Setup</h1>";
  
  if (isAccessPointMode) {
    html += "<div class=\"status info\">";
    html += "Configuration Mode Active<br>";
    html += "Connect to configure your WiFi network";
    html += "</div>";
  } else {
    html += "<div class=\"status success\">";
    html += "Currently connected to: " + WiFi.SSID();
    html += "</div>";
  }
  
  html += "<form method=\"post\" action=\"" + String(isAccessPointMode ? "/" : "/config") + "\">";
  html += "<div class=\"form-group\">";
  html += "<label for=\"ssid\">WiFi Network Name (SSID):</label>";
  html += "<input type=\"text\" id=\"ssid\" name=\"ssid\" value=\"" + savedSSID + "\" required>";
  html += "</div>";
  html += "<div class=\"form-group\">";
  html += "<label for=\"password\">WiFi Password:</label>";
  html += "<input type=\"password\" id=\"password\" name=\"password\" placeholder=\"Enter WiFi password\">";
  html += "</div>";
  html += "<button type=\"submit\" class=\"btn\">Save & Connect</button>";
  html += "</form>";
  html += "<div style=\"margin: 20px 0;\">";
  html += "<button type=\"button\" class=\"btn btn-secondary\" id=\"scan-btn\" onclick=\"scanNetworks()\">Scan Networks</button>";
  html += "</div>";
  html += "<div id=\"network-list\" class=\"network-list\" style=\"display: none;\"></div>";
  html += "<script>";
  html += "function scanNetworks() {";
  html += "document.getElementById('network-list').style.display = 'block';";
  html += "document.getElementById('scan-btn').innerText = 'Scanning...';";
  html += "fetch('/scan').then(response => response.json()).then(data => {";
  html += "const list = document.getElementById('network-list');";
  html += "list.innerHTML = '';";
  html += "data.networks.forEach(network => {";
  html += "const item = document.createElement('div');";
  html += "item.className = 'network-item';";
  html += "item.onclick = () => selectNetwork(network.ssid);";
  html += "item.innerHTML = network.ssid + ' <span class=\"signal-strength\">' + network.rssi + ' dBm</span>';";
  html += "list.appendChild(item);";
  html += "});";
  html += "document.getElementById('scan-btn').innerText = 'Scan Again';";
  html += "}).catch(error => {";
  html += "console.error('Scan failed:', error);";
  html += "document.getElementById('scan-btn').innerText = 'Scan Failed';";
  html += "});";
  html += "}";
  html += "</script>";
  html += "</div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleWiFiConfigSave() {
  String newSSID = server.arg("ssid");
  String newPassword = server.arg("password");
  
  Serial.printf("WiFi config received - SSID: %s\n", newSSID.c_str());
  
  if (newSSID.length() > 0) {
    // Save credentials
    preferences.putString("ssid", newSSID);
    preferences.putString("password", newPassword);
    savedSSID = newSSID;
    savedPassword = newPassword;
    
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>WiFi Configuration</title>";
    html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    html += "<meta http-equiv=\"refresh\" content=\"10;url=/\">";
    html += "<style>";
    html += "body { font-family: Arial; margin: 0; padding: 20px; background: #f0f0f0; text-align: center; }";
    html += ".container { max-width: 500px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; }";
    html += ".spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }";
    html += "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    html += "</style></head><body>";
    html += "<div class=\"container\">";
    html += "<h1>Wash Controller</h1>";
    html += "<div class=\"spinner\"></div>";
    html += "<h2>Connecting to WiFi...</h2>";
    html += "<p>Network: <strong>" + newSSID + "</strong></p>";
    html += "<p>Please wait while the device connects to your network.</p>";
    html += "<p>This page will automatically redirect in 10 seconds.</p>";
    html += "<p><small>If connection fails, the device will return to configuration mode.</small></p>";
    html += "</div></body></html>";
    
    server.send(200, "text/html", html);
    
    // Give time for response to send
    delay(1000);
    
    // Attempt to connect to new network
    Serial.println("Attempting to connect to new WiFi network...");
    connectToWiFi(newSSID.c_str(), newPassword.c_str());
    
    if (!wifiConnected) {
      Serial.println("Failed to connect to new network, returning to AP mode");
      delay(2000);
      startAccessPoint();
    }
  } else {
    server.send(400, "text/html", "<h1>Error: SSID cannot be empty</h1>");
  }
}

void handleWiFiScan() {
  Serial.println("Scanning for WiFi networks...");
  int networkCount = WiFi.scanNetworks();
  
  DynamicJsonDocument doc(2048);
  JsonArray networks = doc.createNestedArray("networks");
  
  for (int i = 0; i < networkCount; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
    network["secure"] = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleConfigStatus() {
  DynamicJsonDocument doc(512);
  doc["mode"] = isAccessPointMode ? "AP" : "STA";
  doc["ssid"] = isAccessPointMode ? apSSID : WiFi.SSID();
  doc["ip"] = isAccessPointMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  doc["connected"] = wifiConnected;
  doc["saved_ssid"] = savedSSID;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleConfigReset() {
  Serial.println("WiFi configuration reset requested");
  preferences.clear();
  savedSSID = "";
  savedPassword = "";
  
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Reset Complete</title>";
  html += "<meta http-equiv=\"refresh\" content=\"3;url=/\">";
  html += "</head><body>";
  html += "<h1>WiFi Configuration Reset</h1>";
  html += "<p>All WiFi settings have been cleared. Device will restart in AP mode.</p>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
  
  delay(3000);
  ESP.restart();
}

void handleGetStatus() {
  DynamicJsonDocument doc(1024);
  
  // System info
  doc["system"] = "online";
  doc["uptime"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_connected"] = wifiConnected;
  doc["backend_connected"] = backendConnected;
  doc["wifi_ssid"] = WiFi.SSID();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["wifi_ip"] = WiFi.localIP().toString();
  doc["backend_url"] = backendUrl;
  doc["config_mode"] = isConfigMode;
  doc["ap_mode"] = isAccessPointMode;
  
  // Relay status
  JsonArray relays = doc.createNestedArray("relays");
  for (int i = 0; i < NUM_RELAYS; i++) {
    JsonObject relay = relays.createNestedObject();
    relay["id"] = i + 1;
    relay["pin"] = relayPins[i];
    relay["state"] = relayStates[i] ? "ON" : "OFF";
    
    if (relayStates[i]) {
      relay["time_remaining"] = max(0L, (long)(RELAY_TRIGGER_DURATION - (millis() - relayTriggerTimes[i])));
      relay["current_command"] = activeCommands[i].id;
      relay["command_source"] = activeCommands[i].source;
    }
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleLocalTrigger() {
  String payload = server.arg("plain");
  DynamicJsonDocument doc(200);
  DeserializationError error = deserializeJson(doc, payload);
  
  if (error) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
    return;
  }
  
  if (!doc.containsKey("relay")) {
    server.send(400, "application/json", "{\"error\":\"Missing relay parameter\"}");
    return;
  }
  
  int relayId = doc["relay"];
  triggerRelay(relayId);
  
  DynamicJsonDocument responseDoc(200);
  responseDoc["success"] = true;
  responseDoc["message"] = "Relay triggered locally";
  responseDoc["relay"] = relayId;
  responseDoc["timestamp"] = millis();
  
  String responseString;
  serializeJson(responseDoc, responseString);
  server.send(200, "application/json", responseString);
}

void handleReset() {
  // Turn off all relays immediately
  for (int i = 0; i < NUM_RELAYS; i++) {
    digitalWrite(relayPins[i], LOW);
    relayStates[i] = false;
    relayTriggerTimes[i] = 0;
    
    // Clear command tracking
    activeCommands[i].id = "";
    activeCommands[i].relayId = 0;
    activeCommands[i].source = "";
    activeCommands[i].notificationSent = true;
  }
  
  Serial.println("LOCAL RESET: All relays reset to OFF");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"All relays reset locally\"}");
} 