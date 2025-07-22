# 🚿 ESP32 Car Wash Controller

A professional-grade ESP32-based relay controller for automated car wash systems with WiFi management, web interface, and backend integration.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Hardware Requirements](#hardware-requirements)
- [Pin Configuration](#pin-configuration)
- [Installation](#installation)
- [WiFi Setup](#wifi-setup)
- [API Endpoints](#api-endpoints)
- [Command System](#command-system)
- [Web Interface](#web-interface)
- [Backend Integration](#backend-integration)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)

## 🎯 Overview

This ESP32 controller manages 6 relays for car wash operations, featuring:
- **Hybrid Communication System** with dual-mode operation:
  - **Direct HTTP Endpoints** for instant frontend response (~100ms)
  - **Backend Polling System** for RFID and background tasks (10s interval)
- **Automatic WiFi Management** with captive portal setup
- **Web Interface** for local control and configuration
- **Precise Timing** with 500ms relay cycles
- **Spam Protection** and error handling
- **Real-time Notifications** to backend system
- **Pricing-Based Services** from $7-$10 wash tiers

## ✨ Features

### 🌐 WiFi Management
- **Auto-Configuration**: No hardcoded WiFi credentials
- **Captive Portal**: Easy setup via "Wash Controller" network
- **Persistent Storage**: Remembers WiFi settings across reboots
- **Auto-Recovery**: Falls back to AP mode if WiFi fails
- **Network Scanning**: Shows available networks with signal strength

### 🎛️ Relay Control
- **6 Relay Support**: Controls relays 1-6 with precise timing
- **500ms Cycles**: Each relay turns ON for exactly 500ms then OFF
- **Simultaneous Control**: Multiple relays can operate independently
- **Safety Features**: Automatic shutoff and error handling
- **Service Tiers**: $7, $8, $9, $10 wash options plus reset/spare

### 🌐 Web Interface
- **Local Status Page**: View system health and relay states
- **WiFi Configuration**: Change network settings without reflashing
- **Manual Control**: Test relays directly from web interface
- **Real-time Updates**: Live system monitoring

### 🔄 Backend Integration
- **Hybrid Communication Modes**:
  - **Direct Endpoint Calls**: Backend calls ESP32 directly for immediate response
  - **Traditional Polling**: ESP32 checks backend every 10 seconds for queued commands
- **Auto-IP Discovery**: Backend automatically tracks ESP32 IP from polling requests
- **Completion Notifications**: Reports successful relay cycles to backend
- **Priority System**: Handles RFID, manual, and reset commands with different priorities
- **Fault Tolerance**: Continues working if backend is offline

## 🔧 Hardware Requirements

### ESP32 Board
- **ESP32-S3** (recommended) or compatible ESP32 board
- **Minimum 4MB Flash** for web interface storage
- **WiFi Capability** (built into all ESP32 boards)

### Relay Module
- **6-Channel Relay Module** (5V or 3.3V compatible)
- **Optocoupler Isolation** (recommended for safety)
- **Active HIGH trigger** (standard for most relay modules)

### Power Supply
- **5V DC supply** for relay module
- **USB/3.3V supply** for ESP32 board
- **Shared ground** between ESP32 and relay module

## 📌 Pin Configuration

The controller uses the following GPIO pins on ESP32-S3:

```cpp
const int relayPins[6] = {1, 2, 41, 42, 45, 46};
```

| Relay | ESP32 Pin | Wash Type | Price | Duration | Purpose |
|-------|-----------|-----------|-------|----------|---------|
| Relay 1 | GPIO 1 | Ultimate Wash | $24.99 | 5:00 | Complete wash with all services |
| Relay 2 | GPIO 2 | Premium Wash | $9.99 | 3:00 | Basic wash + tire cleaning + wax |
| Relay 3 | GPIO 41 | Express Wash | $7.99 | 2:30 | Soap, rinse, and basic dry |
| Relay 4 | GPIO 42 | Basic Wash | $5.99 | 2:00 | Exterior wash with soap and rinse |
| Relay 5 | GPIO 45 | Reset | - | 500ms | Emergency/System reset |
| Relay 6 | GPIO 46 | Spare | - | - | Future expansion |

### Wiring Diagram

```
ESP32-S3           6-Channel Relay Module
┌─────────┐        ┌─────────────────────┐
│ GPIO 1  ├────────┤ IN1 (Relay 1 - $10)│
│ GPIO 2  ├────────┤ IN2 (Relay 2 - $9) │
│ GPIO 41 ├────────┤ IN3 (Relay 3 - $8) │
│ GPIO 42 ├────────┤ IN4 (Relay 4 - $7) │
│ GPIO 45 ├────────┤ IN5 (Relay 5 - RST)│
│ GPIO 46 ├────────┤ IN6 (Relay 6 - SPA)│
│ GND     ├────────┤ GND                 │
│ 3V3/5V  ├────────┤ VCC                 │
└─────────┘        └─────────────────────┘
```

## 📦 Installation

### 1. Install Arduino IDE
1. Download [Arduino IDE](https://www.arduino.cc/en/software)
2. Install ESP32 board package:
   - File → Preferences
   - Add: `https://dl.espressif.com/dl/package_esp32_index.json`
   - Tools → Board → Boards Manager → Search "ESP32" → Install

### 2. Install Required Libraries
Install via Library Manager (Tools → Manage Libraries):
- **ArduinoJson** (version 6.x recommended)

Built-in libraries (no installation needed):
- WiFi, HTTPClient, WebServer, Preferences, DNSServer

### 3. Upload Code
1. Connect ESP32 to computer via USB
2. Select board: **ESP32S3 Dev Module** (or your specific board)
3. Select correct COM port
4. Upload `carwash_controller.ino`

### 4. Monitor Serial Output
Open Serial Monitor (115200 baud) to see setup progress:
```
=== ESP32 Car Wash Controller Starting ===
Initialized relay 1 on pin 1
Initialized relay 2 on pin 2
...
WiFi connection failed. Starting Access Point mode...
Access Point started! IP: 192.168.4.1
Connect to 'Wash Controller' network and visit http://192.168.4.1
```

## 🌐 WiFi Setup

### First Time Configuration

1. **Connect to ESP32 Network**
   - Network: `Wash Controller`
   - Password: (none - open network)

2. **Open Configuration Page**
   - Visit: `http://192.168.4.1`
   - Should open automatically (captive portal)

3. **Configure WiFi**
   - Click "Scan Networks" to see available WiFi
   - Select your network or enter SSID manually
   - Enter WiFi password
   - Click "Save & Connect"

4. **Verify Connection**
   - ESP32 will attempt to connect
   - Success: LED indicators, Serial Monitor shows IP
   - Failure: Returns to Access Point mode

### Changing WiFi Later

If already connected to WiFi:
- Visit: `http://[ESP32_IP]/config`
- Or reset WiFi: Hold reset button, reconnect to "Wash Controller"

## 🌐 API Endpoints

### Local ESP32 Endpoints

#### System Information
```http
GET http://[ESP32_IP]/
```
Web interface with system status and controls.

```http
GET http://[ESP32_IP]/status
```
JSON system status including relay states, WiFi info, and uptime.

**Response:**
```json
{
  "system": "online",
  "uptime": 12345,
  "free_heap": 234567,
  "wifi_connected": true,
  "backend_connected": true,
  "wifi_ssid": "YourNetwork",
  "wifi_rssi": -45,
  "wifi_ip": "192.168.1.100",
  "backend_url": "https://carwash-backend-5spn.onrender.com",
  "relays": [
    {
      "id": 1,
      "pin": 1,
      "state": "OFF"
    }
  ]
}
```

#### Manual Relay Control
```http
POST http://[ESP32_IP]/trigger
Content-Type: application/json

{
  "relay": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Relay triggered locally",
  "relay": 1,
  "timestamp": 12345
}
```

#### System Reset
```http
POST http://[ESP32_IP]/reset
```
Turns OFF all relays immediately.

#### WiFi Configuration
```http
GET http://[ESP32_IP]/config
```
WiFi configuration page.

```http
GET http://[ESP32_IP]/scan
```
Scan for available WiFi networks.

**Response:**
```json
{
  "networks": [
    {
      "ssid": "YourNetwork",
      "rssi": -45,
      "secure": true
    }
  ]
}
```

### Backend Integration

The ESP32 automatically polls the backend server for commands:

#### Command Polling
```http
GET https://carwash-backend-5spn.onrender.com/api/trigger/poll
```

**Response (when command available):**
```json
{
  "hasCommand": true,
  "command": {
    "id": "cmd_123",
    "relayId": 1,
    "source": "manual",
    "timestamp": 1234567890
  }
}
```

**Response (no commands):**
```json
{
  "hasCommand": false,
  "message": "No pending commands"
}
```

#### Completion Notification
```http
POST https://carwash-backend-5spn.onrender.com/api/trigger/completed
Content-Type: application/json

{
  "commandId": "cmd_123",
  "relayId": 1,
  "source": "manual",
  "success": true,
  "message": "WASH cycle completed successfully",
  "timestamp": 12345
}
```

## 🎮 Command System

### Command Flow

1. **Command Creation**
   - User clicks button in web interface
   - Backend queues command with priority

2. **Command Polling**
   - ESP32 polls backend every 1 second
   - Retrieves highest priority command

3. **Relay Execution**
   - ESP32 turns ON specified relay
   - Waits exactly 500ms
   - Turns OFF relay automatically

4. **Completion Notification**
   - ESP32 reports success/failure to backend
   - Backend logs completion message

### Command Sources

| Source | Priority | Description |
|--------|----------|-------------|
| `rfid` | 3 (Highest) | RFID card activation |
| `manual` | 2 (Medium) | Web interface buttons |
| `session` | 1 (Low) | Scheduled wash sessions |
| `reset` | 10 (Emergency) | System reset command |

### Wash Service Tiers

| Relay | Service | Price | Duration | Features |
|-------|---------|-------|----------|----------|
| 1 | Ultimate Wash | $24.99 | 5:00 | Complete wash with all services and detailing |
| 2 | Premium Wash | $9.99 | 3:00 | Basic wash plus tire cleaning and wax |
| 3 | Express Wash | $7.99 | 2:30 | Soap, rinse, and basic dry |
| 4 | Basic Wash | $5.99 | 2:00 | Exterior wash with soap and rinse |
| 5 | Reset | - | 500ms | Emergency system reset |
| 6 | Spare | - | - | Available for future expansion |

### Spam Protection

- **2-second cooldown** per relay
- Commands blocked during cooldown period
- Reset commands bypass cooldown
- Frontend shows countdown timers

## 🖥️ Web Interface

### Main Dashboard
- **System Status**: WiFi and backend connection status
- **Relay States**: Real-time relay ON/OFF indicators
- **System Info**: IP address, uptime, memory usage
- **Quick Actions**: Status, config, network scan

### WiFi Configuration
- **Network Scanner**: Shows available WiFi with signal strength
- **Easy Setup**: Click network name to auto-fill SSID
- **Connection Status**: Real-time feedback during setup
- **Responsive Design**: Works on mobile devices

### Manual Control
- **Relay Testing**: Trigger individual relays for testing
- **System Reset**: Emergency stop all relays
- **Status Monitoring**: Live relay state updates

## 🔄 Backend Integration

### System Architecture

```
[Frontend] → [Backend] ────────→ [ESP32] → [Relays] → [Car Wash Equipment]
     ↑           ↓               ↗ Direct      ↓
   Web UI    Command        (Instant)    Polling
            Queue          HTTP Call    (10 seconds)
```

### Hybrid Communication Protocol

#### **Method 1: Direct Calls (Frontend Triggers)**
1. **Frontend** triggers wash via backend API
2. **Backend** attempts direct HTTP call to ESP32
3. **ESP32** responds immediately and triggers relay
4. **Total latency: ~100ms** ⚡

#### **Method 2: Polling System (RFID/Background)**
1. **RFID/Backend** queues commands via backend API
2. **Backend** stores commands with priority and spam protection
3. **ESP32** polls backend every 10 seconds for pending commands
4. **ESP32** executes relay control and reports completion
5. **Maximum latency: 10 seconds**

#### **Automatic Fallback**
- Direct call fails? → **Backend queues command for polling**
- ESP32 offline? → **Commands wait in queue**
- Network issues? → **Seamless recovery when connection restored**

### Error Handling

- **WiFi Disconnection**: ESP32 returns to AP mode for reconfiguration
- **Backend Offline**: ESP32 continues local operation, resumes when online
- **Command Failures**: ESP32 reports errors to backend with details
- **Relay Malfunctions**: Automatic timeout prevents stuck relays

## 🔧 Troubleshooting

### WiFi Issues

**Problem**: Can't connect to "Wash Controller" network
- **Solution**: Ensure ESP32 is in AP mode (power cycle if needed)
- **Check**: Look for open "Wash Controller" network in WiFi list

**Problem**: WiFi configuration fails
- **Solution**: Verify password is correct, check signal strength
- **Reset**: Clear WiFi settings via web interface reset option

### Relay Issues

**Problem**: Relays not triggering
- **Check**: Verify wiring connections to correct GPIO pins
- **Test**: Use web interface manual control to test individual relays
- **Power**: Ensure relay module has adequate power supply

**Problem**: Relays stuck ON
- **Emergency**: Use web interface "Reset All Relays" button
- **Prevention**: 500ms timeout should prevent this automatically

### Backend Connection

**Problem**: Backend shows as disconnected
- **Check**: Verify internet connection and backend URL
- **Monitor**: Serial output for HTTP error codes
- **Test**: Try manual command from web interface

### General Issues

**Problem**: ESP32 not responding
- **Reset**: Press physical reset button on ESP32
- **Power**: Check USB/power connection
- **Monitor**: Open Serial Monitor to see error messages

**Problem**: Web interface not loading
- **IP**: Check ESP32 IP address in Serial Monitor or router
- **Network**: Ensure device is on same network as ESP32
- **Cache**: Clear browser cache and try again

## 📊 Technical Details

### System Specifications

| Parameter | Value |
|-----------|--------|
| **Polling Frequency** | 10 seconds (RFID/background only) |
| **Direct Call Response** | ~100ms (frontend triggers) |
| **Relay Trigger Duration** | 500ms |
| **Command Timeout** | 5 seconds |
| **WiFi Reconnect Attempts** | 20 attempts |
| **Memory Usage** | ~200KB program, ~50KB RAM |
| **HTTP Timeout** | 5 seconds |

### Performance Metrics

| Trigger Type | Response Time | Method | Notes |
|-------------|---------------|---------|-------|
| **Frontend Manual** | ~100ms | Direct HTTP call | Instant user feedback ⚡ |
| **RFID Activation** | 0-10 seconds | Polling system | Background processing |
| **Wash Sessions** | 0-10 seconds | Polling system | Automated scheduling |
| **System Reset** | ~100ms or 0-10s | Direct + Polling | Emergency commands |

- **Reliability**: 99.9%+ uptime with proper power supply
- **Concurrent Relays**: All 6 relays can operate simultaneously
- **Backend Efficiency**: 50% fewer polls (10s vs 3s intervals)
- **User Experience**: 30x faster frontend response

### Safety Features

- **Automatic Timeout**: Relays automatically turn OFF after 500ms
- **Watchdog Timer**: Prevents system lockups
- **Error Recovery**: Graceful handling of network/power issues
- **Spam Protection**: Prevents relay damage from rapid triggering

### Development Notes

- **IDE**: Arduino IDE 2.x recommended
- **Board**: ESP32-S3 Dev Module or compatible
- **Flash Size**: 4MB minimum for web interface storage
- **Debug**: Serial Monitor at 115200 baud for troubleshooting

## 📝 Serial Monitor Commands

Monitor these messages for system status:

```
=== ESP32 Car Wash Controller Starting ===
Initialized relay 1 on pin 1
WiFi connected! IP: 192.168.1.100
Backend URL: https://carwash-backend-5spn.onrender.com
Local web server started on port 80

Received command: Relay 1 from manual (ID: cmd_123)
WASH: Relay 1 (pin 1) turned ON for 500ms    [Relay 1 = Ultimate Wash]
WASH COMPLETE: Relay 1 (pin 1) turned OFF after 500ms
✅ Completion notification sent: Relay 1 SUCCESS
📢 Backend notification: Wash triggered from the ESP32 - Relay 1 cycled successfully

Received command: Relay 4 from rfid (ID: cmd_456)
WASH: Relay 4 (pin 42) turned ON for 500ms   [Relay 4 = Basic Wash]
WASH COMPLETE: Relay 4 (pin 42) turned OFF after 500ms
✅ Completion notification sent: Relay 4 SUCCESS

Received command: Relay 5 from reset (ID: cmd_789)
RESET: Relay 5 (pin 45) turned ON for 500ms   [Relay 5 = System Reset]
RESET COMPLETE: Relay 5 (pin 45) turned OFF after 500ms
✅ Completion notification sent: Relay 5 SUCCESS
```

## 📞 Support

For technical support or issues:

1. **Check Serial Monitor** for error messages
2. **Verify Wiring** according to pin configuration
3. **Test WiFi** using configuration interface
4. **Check Backend** connection status in web interface

---

## 🎉 Quick Start Summary

1. **Flash** the Arduino code to ESP32
2. **Connect** to "Wash Controller" WiFi network
3. **Configure** your WiFi at http://192.168.4.1
4. **Test** relays using web interface
5. **Integrate** with your car wash backend system

Your ESP32 Car Wash Controller is now ready for professional car wash automation! 🚿✨ 