#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Relay Pin Configuration
const int RELAY_PINS[] = {1, 2, 3, 4, 5}; // GPIO pins for relays 1-5
const int NUM_RELAYS = 6; // Including the blank relay
const int RELAY_DELAY = 500; // 500ms delay for relays 1-4

// Web Server
WebServer server(80);

// Relay States
bool relayStates[NUM_RELAYS] = {false, false, false, false, false, false};

void setup() {
  Serial.begin(115200);
  
  // Initialize relay pins
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW); // Start with relays OFF
  }
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.println("WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Setup server routes
  setupServerRoutes();
  
  // Start server
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  delay(10);
}

void setupServerRoutes() {
  // Health check endpoint
  server.on("/ping", HTTP_GET, []() {
    server.send(200, "text/plain", "ESP32 Car Wash Controller - OK");
  });
  
  // Momentary relay trigger endpoint (legacy)
  server.on("/momentary/:relayId", HTTP_GET, handleMomentaryRelay);
  
  // New trigger endpoint for backend integration
  server.on("/trigger", HTTP_POST, handleTrigger);
  
  // Get relay status
  server.on("/status", HTTP_GET, handleGetStatus);
  
  // Reset all relays
  server.on("/reset", HTTP_POST, handleReset);
  
  // 404 handler
  server.onNotFound([]() {
    server.send(404, "application/json", "{\"error\":\"Endpoint not found\"}");
  });
}

void handleMomentaryRelay() {
  String relayIdStr = server.pathArg(0);
  int relayId = relayIdStr.toInt();
  
  if (relayId < 1 || relayId > NUM_RELAYS) {
    server.send(400, "text/plain", "Invalid relay ID");
    return;
  }
  
  // Convert to 0-based index
  int relayIndex = relayId - 1;
  
  // Trigger the relay
  triggerRelay(relayIndex);
  
  // Send simple response
  server.send(200, "text/plain", "Relay triggered");
}

void handleTrigger() {
  // Parse JSON payload
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
  
  if (relayId < 1 || relayId > NUM_RELAYS) {
    server.send(400, "application/json", "{\"error\":\"Invalid relay ID\"}");
    return;
  }
  
  // Convert to 0-based index
  int relayIndex = relayId - 1;
  
  // Trigger the relay
  triggerRelay(relayIndex);
  
  // Send JSON response
  DynamicJsonDocument responseDoc(200);
  responseDoc["success"] = true;
  responseDoc["message"] = "Relay triggered";
  responseDoc["relay"] = relayId;
  responseDoc["timestamp"] = millis();
  
  String responseString;
  serializeJson(responseDoc, responseString);
  server.send(200, "application/json", responseString);
}

void handleGetStatus() {
  DynamicJsonDocument doc(400);
  JsonArray relays = doc.createNestedArray("relays");
  
  for (int i = 0; i < NUM_RELAYS; i++) {
    JsonObject relay = relays.createNestedObject();
    relay["id"] = i + 1;
    relay["state"] = relayStates[i] ? "ON" : "OFF";
    relay["pin"] = RELAY_PINS[i];
  }
  
  doc["system"] = "online";
  doc["uptime"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  
  String responseString;
  serializeJson(doc, responseString);
  server.send(200, "application/json", responseString);
}

void handleReset() {
  // Turn off all relays
  for (int i = 0; i < NUM_RELAYS; i++) {
    digitalWrite(RELAY_PINS[i], LOW);
    relayStates[i] = false;
  }
  
  server.send(200, "text/plain", "All relays reset");
}

void triggerRelay(int relayIndex) {
  if (relayIndex < 0 || relayIndex >= NUM_RELAYS) {
    return;
  }
  
  int pin = RELAY_PINS[relayIndex];
  
  // For relays 1-4 (index 0-3), use toggle logic with delay
  if (relayIndex < 4) {
    // Turn ON
    digitalWrite(pin, HIGH);
    relayStates[relayIndex] = true;
    
    // Wait for specified delay
    delay(RELAY_DELAY);
    
    // Turn OFF
    digitalWrite(pin, LOW);
    relayStates[relayIndex] = false;
    
    Serial.printf("Relay %d triggered (ON for %dms)\n", relayIndex + 1, RELAY_DELAY);
  }
  // For relay 5 (index 4), use reset logic
  else if (relayIndex == 4) {
    // Turn ON
    digitalWrite(pin, HIGH);
    relayStates[relayIndex] = true;
    
    // Keep ON for 1 second
    delay(1000);
    
    // Turn OFF
    digitalWrite(pin, LOW);
    relayStates[relayIndex] = false;
    
    Serial.printf("Relay %d (Reset) triggered\n", relayIndex + 1);
  }
  // For relay 6 (index 5), blank relay - no action
  else {
    Serial.printf("Relay %d (Blank) - no action\n", relayIndex + 1);
  }
}

// Utility function to get relay status as string
String getRelayStatus(int relayIndex) {
  if (relayIndex < 0 || relayIndex >= NUM_RELAYS) {
    return "INVALID";
  }
  return relayStates[relayIndex] ? "ON" : "OFF";
} 