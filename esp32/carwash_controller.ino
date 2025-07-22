#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DNSServer.h>

// Backend Configuration
String backendUrl = "https://carwash-backend-5spn.onrender.com"; // Default value
String savedBackendUrl = "";

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
const unsigned long POLL_INTERVAL = 1000; // Poll every 1 second (ultra-responsive for RFID, direct calls still handle frontend)

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

// Activity logging
struct LogEntry {
  String timestamp;
  String washType;
  String source;
  String deviceInfo;
  String userName;
  unsigned long triggerTime; // millis() when triggered
};
const int MAX_LOG_ENTRIES = 10;
LogEntry activityLog[MAX_LOG_ENTRIES];
int logIndex = 0;
int logCount = 0;

// Time management (for timestamps)
unsigned long systemStartTime = 0;
// Base date: July 21, 2025 (when system was deployed)
int baseYear = 2025;
int baseMonth = 7;
int baseDay = 21;

// Authentication
bool isAuthenticated = false;
const String validPasswords[3] = {"0123", "0987", "0321"};
const String userNames[3] = {"Stephen", "Victor", "Liz"};
String currentUser = "";
unsigned long lastActivity = 0;
const unsigned long SESSION_TIMEOUT = 1800000; // 30 minutes in milliseconds

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Car Wash Controller Starting ===");
  
  // Initialize system start time
  systemStartTime = millis();
  
  // Initialize preferences
  preferences.begin("wifi-config", false);
  
  // Load saved WiFi credentials
  savedSSID = preferences.getString("ssid", "");
  savedPassword = preferences.getString("password", "");
  
  // Load saved backend URL
  savedBackendUrl = preferences.getString("backend", "");
  if (savedBackendUrl.length() > 0) {
    backendUrl = savedBackendUrl;
    Serial.printf("Loaded saved backend URL: %s\n", backendUrl.c_str());
  }
  
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

bool checkAuthentication() {
  if (!isAuthenticated) {
    return false;
  }
  
  // Check session timeout
  if (millis() - lastActivity > SESSION_TIMEOUT) {
    Serial.printf("Session expired - user %s logged out\n", currentUser.c_str());
    isAuthenticated = false;
    currentUser = "";
    return false;
  }
  
  // Update last activity
  lastActivity = millis();
  return true;
}

String validatePassword(String password) {
  for (int i = 0; i < 3; i++) {
    if (password == validPasswords[i]) {
      return userNames[i];
    }
  }
  return ""; // Empty string means invalid password
}

void calculateDate(unsigned long triggerTime, int &year, int &month, int &day, int &hour, int &minute) {
  // Calculate elapsed seconds since system start
  unsigned long elapsedSeconds = triggerTime / 1000;
  unsigned long elapsedDays = elapsedSeconds / 86400;
  
  // Start with base date
  year = baseYear;
  month = baseMonth;
  day = baseDay;
  
  // Add elapsed days
  day += elapsedDays;
  
  // Days in each month (non-leap year)
  int daysInMonth[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  
  // Handle month/year overflow
  while (day > daysInMonth[month - 1]) {
    day -= daysInMonth[month - 1];
    month++;
    if (month > 12) {
      month = 1;
      year++;
      // Update February for leap years
      if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) {
        daysInMonth[1] = 29;
      } else {
        daysInMonth[1] = 28;
      }
    }
  }
  
  // Calculate hour and minute
  unsigned long remainingSeconds = elapsedSeconds % 86400;
  hour = remainingSeconds / 3600;
  minute = (remainingSeconds % 3600) / 60;
}

String formatTimestamp(unsigned long triggerTime) {
  int year, month, day, hour, minute;
  calculateDate(triggerTime, year, month, day, hour, minute);
  
  // Format as MM/DD/YY HH:MM
  String timestamp = "";
  if (month < 10) timestamp += "0";
  timestamp += String(month) + "/";
  if (day < 10) timestamp += "0";
  timestamp += String(day) + "/";
  timestamp += String(year % 100);  // YY format
  timestamp += " ";
  if (hour < 10) timestamp += "0";
  timestamp += String(hour) + ":";
  if (minute < 10) timestamp += "0";
  timestamp += String(minute);
  
  return timestamp;
}

String formatDuration(unsigned long triggerTime) {
  unsigned long currentTime = millis();
  unsigned long elapsed = (currentTime - triggerTime) / 1000;
  
  if (elapsed < 60) {
    return String(elapsed) + "s ago";
  } else if (elapsed < 3600) {
    return String(elapsed / 60) + "m " + String(elapsed % 60) + "s ago";
  } else {
    return String(elapsed / 3600) + "h " + String((elapsed % 3600) / 60) + "m ago";
  }
}

void addLogEntry(int relayId, String source, String deviceInfo, String userName = "") {
  String washNames[NUM_RELAYS] = {"Ultimate Wash", "Premium Wash", "Express Wash", "Basic Wash", "Reset Function", "Spare"};
  
  unsigned long currentTime = millis();
  
  // Add to circular buffer
  activityLog[logIndex].timestamp = formatTimestamp(currentTime);
  activityLog[logIndex].triggerTime = currentTime;
  
  if (relayId == 0) {
    activityLog[logIndex].washType = "All Relays Reset";
  } else if (relayId >= 1 && relayId <= NUM_RELAYS) {
    activityLog[logIndex].washType = washNames[relayId - 1];
  } else {
    activityLog[logIndex].washType = "Unknown";
  }
  activityLog[logIndex].source = source;
  activityLog[logIndex].deviceInfo = deviceInfo;
  activityLog[logIndex].userName = userName;
  
  logIndex = (logIndex + 1) % MAX_LOG_ENTRIES;
  if (logCount < MAX_LOG_ENTRIES) {
    logCount++;
  }
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
  
  // Log the activity
  String deviceInfo = "Backend";
  String logUserName = "";
  if (source == "local") {
    deviceInfo = "ESP32 Web UI (" + WiFi.localIP().toString() + ")";
    logUserName = currentUser; // Include current logged-in user for local triggers
  } else if (source == "reset") {
    deviceInfo = "Backend Reset";
  }
  addLogEntry(relayId, source, deviceInfo, logUserName);
  
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
  server.on("/backend", HTTP_POST, handleBackendConfigSave);
  
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
  
  // Backend configuration
  server.on("/backend", HTTP_POST, handleBackendConfigSave);
  
  // Authentication routes
  server.on("/login", HTTP_POST, handleLogin);
  server.on("/logout", HTTP_GET, handleLogout);
  
  // Settings page
  server.on("/settings", HTTP_GET, handleSettings);
  
  // 404 handler
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
  });
  
  server.begin();
  Serial.println("Local web server started on port 80");
}

void handleRoot() {
  // Check authentication first
  if (!checkAuthentication()) {
    handleLoginPage();
    return;
  }
  
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Controller</title>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>";
  html += "body { font-family: Arial; margin: 20px; background: #f0f0f0; }";
  html += ".container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }";
  html += ".status { padding: 10px; margin: 10px 0; border-radius: 5px; }";
  html += ".online { background: #d4edda; color: #155724; }";
  html += ".offline { background: #f8d7da; color: #721c24; }";
  html += ".btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 5px; cursor: pointer; }";
  html += ".btn:hover { background: #0056b3; }";
  html += ".btn:disabled { background: #6c757d; cursor: not-allowed; }";
  html += ".wash-btn { background: #28a745; font-size: 16px; font-weight: bold; padding: 15px 25px; margin: 8px; min-width: 120px; }";
  html += ".wash-btn:hover { background: #218838; }";
  html += ".wash-btn:disabled { background: #6c757d; }";
  html += ".wash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0; }";
  html += ".danger { background: #dc3545; }";
  html += ".danger:hover { background: #c82333; }";
  html += ".message { padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center; }";
  html += ".success { background: #d4edda; color: #155724; }";
  html += ".error { background: #f8d7da; color: #721c24; }";
  html += "</style>";
  html += "<script>";
  html += "function triggerWash(relayId) {";
  html += "const washNames = ['Ultimate Wash', 'Premium Wash', 'Express Wash', 'Basic Wash', 'Reset Function', 'Spare'];";
  html += "const washName = washNames[relayId - 1];";
  html += "const btn = document.getElementById('wash-' + relayId);";
  html += "const originalText = btn.innerHTML;";
  html += "btn.disabled = true;";
  html += "btn.innerHTML = 'Triggering...';";
  html += "showMessage('Triggering ' + washName + '...', 'success');";
  html += "fetch('/trigger', {";
  html += "method: 'POST',";
  html += "headers: { 'Content-Type': 'application/json' },";
  html += "body: JSON.stringify({ relay: relayId })";
  html += "}).then(response => response.json()).then(data => {";
  html += "if (data.success) {";
  html += "showMessage(washName + ' activated for 500ms', 'success');";
  html += "setTimeout(() => { location.reload(); }, 1000);"; // Refresh page to update log
  html += "} else {";
  html += "showMessage('Failed to trigger ' + washName, 'error');";
  html += "}";
  html += "btn.disabled = false;";
  html += "btn.innerHTML = originalText;";
  html += "}).catch(error => {";
  html += "console.error('Error:', error);";
  html += "showMessage('Network error triggering ' + washName, 'error');";
  html += "btn.disabled = false;";
  html += "btn.innerHTML = originalText;";
  html += "});";
  html += "}";
  html += "function showMessage(text, type) {";
  html += "const messageDiv = document.getElementById('message');";
  html += "messageDiv.className = 'message ' + type;";
  html += "messageDiv.innerHTML = text;";
  html += "messageDiv.style.display = 'block';";
  html += "setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);";
  html += "}";
  html += "// Auto-refresh page every 30 seconds to update durations";
  html += "setInterval(() => { if (!document.querySelector('button:disabled')) location.reload(); }, 30000);";
  html += "</script>";
  html += "</head><body>";
  html += "<div class=\"container\">";
  html += "<div style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;\">";
  html += "<div>";
  html += "<p style=\"margin: 0; color: #666; font-size: 14px;\">Logged in as: <strong>" + currentUser + "</strong></p>";
  html += "</div>";
  html += "<div>";
  html += "<a href=\"/settings\" class=\"btn\" style=\"background: #28a745; margin-right: 10px;\">Settings</a>";
  html += "<a href=\"/logout\" class=\"btn\" style=\"background: #6c757d;\">Logout</a>";
  html += "</div>";
  html += "</div>";
  html += "<div id=\"message\" class=\"message\" style=\"display: none;\"></div>";
  
  // WASH CONTROLS AT TOP
  html += "<h2>Manual Wash Controls</h2>";
  html += "<div class=\"wash-grid\">";
  
  // Define wash station names
  String washNames[NUM_RELAYS] = {
    "Ultimate Wash",
    "Premium Wash", 
    "Express Wash",
    "Basic Wash",
    "Reset Function",
    "Spare"
  };
  
  for (int i = 1; i <= NUM_RELAYS; i++) {
    html += "<button id=\"wash-" + String(i) + "\" class=\"btn wash-btn\" onclick=\"triggerWash(" + String(i) + ")\">";
    html += washNames[i-1] + "</button>";
  }
  html += "</div>";
  
  // ACTIVITY LOG
  html += "<h2>Recent Activity Log</h2>";
  html += "<div style=\"background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 15px 0; max-height: 300px; overflow-y: auto;\">";
  if (logCount == 0) {
    html += "<p style=\"color: #6c757d; text-align: center; margin: 0;\">No wash activity yet</p>";
  } else {
    html += "<table style=\"width: 100%; border-collapse: collapse; font-size: 13px;\">";
    html += "<thead><tr style=\"background: #e9ecef;\">";
    html += "<th style=\"padding: 6px; text-align: left; border-bottom: 1px solid #dee2e6; font-size: 12px;\">Timestamp</th>";
    html += "<th style=\"padding: 6px; text-align: left; border-bottom: 1px solid #dee2e6; font-size: 12px;\">Duration</th>";
    html += "<th style=\"padding: 6px; text-align: left; border-bottom: 1px solid #dee2e6; font-size: 12px;\">Wash Type</th>";
    html += "<th style=\"padding: 6px; text-align: left; border-bottom: 1px solid #dee2e6; font-size: 12px;\">User</th>";
    html += "<th style=\"padding: 6px; text-align: left; border-bottom: 1px solid #dee2e6; font-size: 12px;\">Source</th>";
    html += "</tr></thead><tbody>";
    
    // Display log entries in reverse order (newest first)
    for (int i = 0; i < logCount; i++) {
      int displayIndex = (logIndex - 1 - i + MAX_LOG_ENTRIES) % MAX_LOG_ENTRIES;
      html += "<tr>";
      html += "<td style=\"padding: 4px 6px; border-bottom: 1px solid #f1f3f4; font-size: 11px;\">" + activityLog[displayIndex].timestamp + "</td>";
      html += "<td style=\"padding: 4px 6px; border-bottom: 1px solid #f1f3f4; font-size: 11px; color: #666;\">" + formatDuration(activityLog[displayIndex].triggerTime) + "</td>";
      html += "<td style=\"padding: 4px 6px; border-bottom: 1px solid #f1f3f4; font-weight: bold; font-size: 12px;\">" + activityLog[displayIndex].washType + "</td>";
      String userDisplay = (activityLog[displayIndex].userName != "") ? activityLog[displayIndex].userName : "-";
      html += "<td style=\"padding: 4px 6px; border-bottom: 1px solid #f1f3f4; font-weight: bold; color: #007bff; font-size: 12px;\">" + userDisplay + "</td>";
      html += "<td style=\"padding: 4px 6px; border-bottom: 1px solid #f1f3f4; font-size: 11px;\">" + activityLog[displayIndex].source + "</td>";
      html += "</tr>";
    }
    html += "</tbody></table>";
  }
  html += "</div>";
  html += "</div></body></html>";
  
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
  html += "<h1>WiFi Setup</h1>";
  
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
  html += "<h2>Backend Configuration</h2>";
  html += "<form method=\"post\" action=\"/backend\">";
  html += "<div class=\"form-group\">";
  html += "<label for=\"backend-url\">Backend URL:</label>";
  html += "<input type=\"url\" id=\"backend-url\" name=\"backend\" value=\"" + backendUrl + "\" placeholder=\"https://your-backend.com\" required>";
  html += "</div>";
  html += "<button type=\"submit\" class=\"btn\">Update Backend</button>";
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
  // Check authentication for detailed status
  if (!checkAuthentication()) {
    server.send(401, "application/json", "{\"error\":\"Authentication required\"}");
    return;
  }
  
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
  doc["saved_backend_url"] = savedBackendUrl;
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
  // Check authentication for protected actions
  if (!checkAuthentication()) {
    server.send(401, "application/json", "{\"error\":\"Authentication required\"}");
    return;
  }
  
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

void handleBackendConfigSave() {
  // Check authentication for configuration changes
  if (!checkAuthentication()) {
    server.send(401, "text/html", "<h1>Authentication Required</h1><p><a href='/'>Login</a></p>");
    return;
  }
  
  String newBackendUrl = server.arg("backend");
  
  Serial.printf("Backend config received - URL: %s\n", newBackendUrl.c_str());
  
  if (newBackendUrl.length() > 0) {
    // Save backend URL
    preferences.putString("backend", newBackendUrl);
    savedBackendUrl = newBackendUrl;
    backendUrl = newBackendUrl;
    
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>Backend Updated</title>";
    html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    html += "<meta http-equiv=\"refresh\" content=\"3;url=/\">";
    html += "<style>";
    html += "body { font-family: Arial; margin: 0; padding: 20px; background: #f0f0f0; text-align: center; }";
    html += ".container { max-width: 500px; margin: 50px auto; background: white; padding: 30px; border-radius: 10px; }";
    html += "</style></head><body>";
    html += "<div class=\"container\">";
    html += "<h2>Backend URL Updated</h2>";
    html += "<p>New Backend: <strong>" + newBackendUrl + "</strong></p>";
    html += "<p>Configuration saved successfully!</p>";
    html += "<p>Redirecting to main page in 3 seconds...</p>";
    html += "</div></body></html>";
    
    server.send(200, "text/html", html);
    
    Serial.printf("Backend URL updated to: %s\n", backendUrl.c_str());
  } else {
    server.send(400, "text/html", "<h1>Error: Backend URL cannot be empty</h1>");
  }
}

void handleLoginPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Login</title>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>";
  html += "body { font-family: Arial; margin: 0; padding: 20px; background: #f0f0f0; }";
  html += ".container { max-width: 400px; margin: 100px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }";
  html += "h1 { color: #333; margin-bottom: 30px; }";
  html += ".form-group { margin-bottom: 20px; }";
  html += "label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }";
  html += "input[type='password'] { width: 200px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 18px; text-align: center; letter-spacing: 8px; }";
  html += "input[type='password']:focus { outline: none; border-color: #007bff; }";
  html += ".btn { background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; }";
  html += ".btn:hover { background: #0056b3; }";
  html += ".error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin-bottom: 20px; }";
  html += ".lock-icon { font-size: 48px; color: #007bff; margin-bottom: 20px; }";
  html += "</style></head><body>";
  html += "<div class=\"container\">";
  html += "<form method=\"post\" action=\"/login\">";
  html += "<div class=\"form-group\">";
  html += "<label for=\"password\">Password:</label>";
  html += "<input type=\"password\" id=\"password\" name=\"password\" maxlength=\"4\" pattern=\"[0-9]{4}\" required autofocus>";
  html += "</div>";
  html += "<button type=\"submit\" class=\"btn\">Login</button>";
  html += "</form>";
  html += "<script>";
  html += "document.getElementById('password').addEventListener('input', function(e) {";
  html += "e.target.value = e.target.value.replace(/[^0-9]/g, '');";
  html += "if (e.target.value.length === 4) { e.target.form.submit(); }";
  html += "});";
  html += "</script>";
  html += "</div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleLogin() {
  String password = server.arg("password");
  String userName = validatePassword(password);
  
  if (userName != "") {
    isAuthenticated = true;
    currentUser = userName;
    lastActivity = millis();
    Serial.printf("User %s authenticated with password: %s\n", userName.c_str(), password.c_str());
    
    // Redirect to main page
    server.sendHeader("Location", "/");
    server.send(302, "text/plain", "");
  } else {
    Serial.printf("Failed login attempt with password: %s\n", password.c_str());
    
    // Show login page with error
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>Login Failed</title>";
    html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
    html += "<meta http-equiv=\"refresh\" content=\"3;url=/\">";
    html += "<style>";
    html += "body { font-family: Arial; margin: 0; padding: 20px; background: #f0f0f0; }";
    html += ".container { max-width: 400px; margin: 100px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }";
    html += ".error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-bottom: 20px; font-weight: bold; }";
    html += "</style></head><body>";
    html += "<div class=\"container\">";
    html += "<h1>Login Failed</h1>";
    html += "<div class=\"error\">Invalid password. Please try again.</div>";
    html += "<p>Redirecting to login page in 3 seconds...</p>";
    html += "</div></body></html>";
    
    server.send(401, "text/html", html);
  }
}

void handleLogout() {
  Serial.printf("User %s logged out\n", currentUser.c_str());
  isAuthenticated = false;
  currentUser = "";
  
  // Redirect to login page
  server.sendHeader("Location", "/");
  server.send(302, "text/plain", "");
}

void handleSettings() {
  // Check authentication first
  if (!checkAuthentication()) {
    handleLoginPage();
    return;
  }
  
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Settings</title>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<style>";
  html += "body { font-family: Arial; margin: 20px; background: #f0f0f0; }";
  html += ".container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }";
  html += ".status { padding: 10px; margin: 10px 0; border-radius: 5px; }";
  html += ".online { background: #d4edda; color: #155724; }";
  html += ".offline { background: #f8d7da; color: #721c24; }";
  html += ".btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin: 5px; cursor: pointer; }";
  html += ".btn:hover { background: #0056b3; }";
  html += ".btn:disabled { background: #6c757d; cursor: not-allowed; }";
  html += ".danger { background: #dc3545; }";
  html += ".danger:hover { background: #c82333; }";
  html += ".back-btn { background: #6c757d; }";
  html += ".back-btn:hover { background: #545b62; }";
  html += "</style></head><body>";
  html += "<div class=\"container\">";
  
  // Header with back button
  html += "<div style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;\">";
  html += "<div>";
  html += "<h1 style=\"margin: 0;\">Settings</h1>";
  html += "<p style=\"margin: 5px 0 0 0; color: #666; font-size: 14px;\">Logged in as: <strong>" + currentUser + "</strong></p>";
  html += "</div>";
  html += "<div>";
  html += "<a href=\"/\" class=\"btn back-btn\">Back to Controls</a>";
  html += "<a href=\"/logout\" class=\"btn danger\" style=\"margin-left: 10px;\">Logout</a>";
  html += "</div>";
  html += "</div>";
  
  // SYSTEM STATUS
  html += "<h2>System Status</h2>";
  html += "<div class=\"status " + String(wifiConnected ? "online" : "offline") + "\">";
  html += "WiFi: " + String(wifiConnected ? "Connected" : "Disconnected");
  html += "</div>";
  html += "<div class=\"status " + String(backendConnected ? "online" : "offline") + "\">";
  html += "Backend: " + String(backendConnected ? "Connected" : "Disconnected");
  html += "</div>";
  html += "<p><strong>WiFi:</strong> " + WiFi.SSID() + "</p>";
  html += "<p><strong>IP Address:</strong> " + WiFi.localIP().toString() + "</p>";
  html += "<p><strong>Backend:</strong> " + backendUrl + "</p>";
  html += "<p><strong>Uptime:</strong> " + String(millis() / 1000) + " seconds</p>";
  
  // Session info
  unsigned long sessionTime = (millis() - lastActivity) / 1000;
  unsigned long sessionRemaining = (SESSION_TIMEOUT - (millis() - lastActivity)) / 1000;
  html += "<p><strong>Current User:</strong> " + currentUser + "</p>";
  html += "<p><strong>Session:</strong> " + String(sessionRemaining / 60) + "m " + String(sessionRemaining % 60) + "s remaining</p>";
  
  // BACKEND CONFIGURATION
  html += "<h2>Backend Configuration</h2>";
  html += "<form method=\"post\" action=\"/backend\">";
  html += "<div style=\"margin-bottom: 15px;\">";
  html += "<label for=\"backend-url\" style=\"display: block; margin-bottom: 5px; font-weight: bold;\">Backend URL:</label>";
  html += "<input type=\"url\" id=\"backend-url\" name=\"backend\" value=\"" + backendUrl + "\" ";
  html += "style=\"width: calc(100% - 110px); padding: 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;\" ";
  html += "placeholder=\"https://your-backend.com\" required>";
  html += "<button type=\"submit\" class=\"btn\" style=\"margin-left: 10px; padding: 8px 15px;\">Update</button>";
  html += "</div>";
  html += "</form>";
  
  // SYSTEM ACTIONS
  html += "<h2>System Actions</h2>";
  html += "<a href=\"/status\" class=\"btn\">System Status</a>";
  html += "<a href=\"/config\" class=\"btn\">WiFi Config</a>";
  html += "<a href=\"/scan\" class=\"btn\">Scan Networks</a>";
  
  // DANGER ZONE
  html += "<h2>Danger Zone</h2>";
  html += "<form method=\"post\" action=\"/reset\" style=\"display: inline;\">";
  html += "<button type=\"submit\" class=\"btn danger\" onclick=\"return confirm('Reset all relays?')\">Reset All Relays</button>";
  html += "</form>";
  
  html += "</div></body></html>";
  
  server.send(200, "text/html", html);
}

void handleReset() {
  // Check authentication for protected actions
  if (!checkAuthentication()) {
    server.send(401, "application/json", "{\"error\":\"Authentication required\"}");
    return;
  }
  
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
  
  // Log the reset activity
  addLogEntry(0, "reset", "ESP32 Web UI (" + WiFi.localIP().toString() + ")", currentUser);
  
  Serial.println("LOCAL RESET: All relays reset to OFF");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"All relays reset locally\"}");
} 