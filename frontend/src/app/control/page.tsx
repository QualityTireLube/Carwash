'use client'

import { useState, useEffect } from 'react'
import { Zap, RotateCcw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface RelayStatus {
  id: number
  state: 'ON' | 'OFF'
  pin: number
}

interface SystemStatus {
  system: string
  uptime: number
  free_heap: number
  relays: RelayStatus[]
}

interface CooldownInfo {
  relayId: number
  remainingTime: number
}

export default function ControlPanel() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastTriggered, setLastTriggered] = useState<number | null>(null)
  const [espOnline, setEspOnline] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [cooldowns, setCooldowns] = useState<CooldownInfo[]>([])
  const [esp32Bypass, setEsp32Bypass] = useState<boolean>(false)

  // Load ESP32 bypass setting and listen for changes
  useEffect(() => {
    const loadBypassSetting = () => {
      const savedBypass = localStorage.getItem('esp32Bypass')
      setEsp32Bypass(savedBypass === 'true')
    }
    
    loadBypassSetting()
    
    const handleBypassChange = (event: CustomEvent) => {
      setEsp32Bypass(event.detail)
    }
    
    window.addEventListener('esp32BypassChanged', handleBypassChange as EventListener)
    
    return () => {
      window.removeEventListener('esp32BypassChanged', handleBypassChange as EventListener)
    }
  }, [])

  useEffect(() => {
    fetchSystemStatus()
    const interval = setInterval(fetchSystemStatus, 15000) // Update every 15 seconds (reduced for rate limiting)
    return () => clearInterval(interval)
  }, [])

  // Update cooldown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => prev
        .map(cooldown => ({
          ...cooldown,
          remainingTime: Math.max(0, cooldown.remainingTime - 1000)
        }))
        .filter(cooldown => cooldown.remainingTime > 0)
      )
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/status`)
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data.status)
        setEspOnline(true)
      } else {
        setEspOnline(false)
        setSystemStatus(null)
      }
    } catch (error) {
      console.debug('ESP32 status check failed (expected if hardware is offline):', error)
      setEspOnline(false)
      setSystemStatus(null)
    }
  }

  const getRelayCooldown = (relayId: number): number => {
    const cooldown = cooldowns.find(c => c.relayId === relayId)
    return cooldown ? cooldown.remainingTime : 0
  }

  const isRelayOnCooldown = (relayId: number): boolean => {
    return getRelayCooldown(relayId) > 0
  }

  const triggerRelay = async (relayId: number) => {
    if (!espOnline && !esp32Bypass) {
      setError('ESP32 controller is offline. Cannot trigger relays.')
      return
    }

    if (isRelayOnCooldown(relayId)) {
      const remainingSeconds = Math.ceil(getRelayCooldown(relayId) / 1000)
      setError(`Please wait ${remainingSeconds} seconds before triggering Relay ${relayId} again`)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/${relayId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setLastTriggered(relayId)
        setTimeout(() => setLastTriggered(null), 2000) // Clear after 2 seconds
        fetchSystemStatus() // Refresh status
        
        // Add cooldown for this relay (2 seconds)
        setCooldowns(prev => [
          ...prev.filter(c => c.relayId !== relayId),
          { relayId, remainingTime: 2000 }
        ])
      } else if (response.status === 429) {
        // Handle spam protection error
        setError(data.error || 'Command blocked - please wait before trying again')
        
        // Extract cooldown time from error message if available
        const cooldownMatch = data.error?.match(/wait (\d+) seconds/)
        if (cooldownMatch) {
          const cooldownSeconds = parseInt(cooldownMatch[1])
          setCooldowns(prev => [
            ...prev.filter(c => c.relayId !== relayId),
            { relayId, remainingTime: cooldownSeconds * 1000 }
          ])
        }
      } else {
        setError(`Failed to trigger relay: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error triggering relay:', error)
      setError('Failed to trigger relay. ESP32 may be offline.')
    } finally {
      setLoading(false)
    }
  }

  const washTypes = [
    { id: 1, name: '$10 Wash', description: 'Premium service with all features', duration: '8 min' },
    { id: 2, name: '$9 Wash', description: 'Deluxe service with premium features', duration: '6 min' },
    { id: 3, name: '$8 Wash', description: 'Standard service with essential features', duration: '5 min' },
    { id: 4, name: '$7 Wash', description: 'Basic service with core features', duration: '3 min' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manual Control Panel</h1>
              <p className="text-gray-600">Direct relay control for car wash system</p>
            </div>
            <Link href="/" className="btn btn-secondary btn-md">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ESP32 Status Banner */}
        {!espOnline && !esp32Bypass && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-yellow-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  ESP32 Controller Offline
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  The ESP32 hardware controller is not connected. Relay controls are disabled until connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ESP32 Bypass Status Banner */}
        {esp32Bypass && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-orange-800">
                  ESP32 Bypass Mode Active
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  ESP32 connectivity checks are bypassed. Commands will be sent but physical relays may not respond if ESP32 is offline.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className={`mb-6 border rounded-lg p-4 ${
            error.startsWith('✅') 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* System Status */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${systemStatus?.system === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-600">ESP32: {systemStatus?.system || 'Unknown'}</span>
            </div>
            <div className="text-gray-600">
              Uptime: {systemStatus?.uptime ? Math.floor(systemStatus.uptime / 1000 / 60) : 0} min
            </div>
            <div className="text-gray-600">
              Free Memory: {systemStatus?.free_heap || 0} bytes
            </div>
          </div>
        </div>

        {/* Wash Type Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Wash Types</h2>
            <div className="space-y-4">
              {washTypes.map((washType) => {
                const cooldownTime = getRelayCooldown(washType.id)
                const isOnCooldown = isRelayOnCooldown(washType.id)
                const isTriggered = lastTriggered === washType.id
                                  const isDisabled = loading || (!espOnline && !esp32Bypass) || isOnCooldown
                
                return (
                  <div key={washType.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{washType.name}</h3>
                        <p className="text-sm text-gray-600">{washType.description}</p>
                        <p className="text-xs text-gray-500">Duration: {washType.duration}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <button
                          onClick={() => triggerRelay(washType.id)}
                          disabled={isDisabled}
                          className={`btn btn-primary btn-sm ${
                            isTriggered ? 'bg-green-600' : 
                            isOnCooldown ? 'bg-gray-400 cursor-not-allowed' :
                            (!espOnline && !esp32Bypass) ? 'bg-gray-400 cursor-not-allowed' : ''
                          }`}
                        >
                          {isTriggered ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : isOnCooldown ? (
                            <Clock className="h-4 w-4" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          {isTriggered ? 'Triggered' : 
                           isOnCooldown ? `Wait ${Math.ceil(cooldownTime / 1000)}s` : 
                           'Trigger'}
                        </button>
                        
                        {isOnCooldown && (
                          <div className="text-xs text-gray-500 text-center">
                            Cooldown: {Math.ceil(cooldownTime / 1000)}s
                          </div>
                        )}
                      </div>
                    </div>
                    {systemStatus?.relays && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">Relay {washType.id}:</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          systemStatus.relays[washType.id - 1]?.state === 'ON'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {systemStatus.relays[washType.id - 1]?.state || 'OFF'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Manual Controls */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Controls</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5].map((relayId) => {
                  const cooldownTime = getRelayCooldown(relayId)
                  const isOnCooldown = isRelayOnCooldown(relayId)
                  const isTriggered = lastTriggered === relayId
                  const isDisabled = loading || (!espOnline && !esp32Bypass) || isOnCooldown
                  const buttonLabel = relayId === 5 ? 'Spare' : `Relay ${relayId}`
                  
                  return (
                    <div key={relayId} className="flex flex-col space-y-2">
                      <button
                        onClick={() => triggerRelay(relayId)}
                        disabled={isDisabled}
                        className={`btn btn-secondary btn-md ${
                          isTriggered ? 'bg-green-600 text-white' : 
                          isOnCooldown ? 'bg-gray-400 cursor-not-allowed' :
                          (!espOnline && !esp32Bypass) ? 'bg-gray-400 cursor-not-allowed' : ''
                        }`}
                      >
                        {isTriggered ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : isOnCooldown ? (
                          <Clock className="h-4 w-4 mr-2" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        {isTriggered ? 'Triggered' : 
                         isOnCooldown ? `${Math.ceil(cooldownTime / 1000)}s` : 
                         buttonLabel}
                      </button>
                      
                      {isOnCooldown && (
                        <div className="text-xs text-gray-500 text-center">
                          Cooldown: {Math.ceil(cooldownTime / 1000)}s
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Relay Status */}
        {systemStatus?.relays && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Relay Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {systemStatus.relays.map((relay) => {
                const cooldownTime = getRelayCooldown(relay.id)
                const isOnCooldown = isRelayOnCooldown(relay.id)
                
                return (
                  <div key={relay.id} className="text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${
                      relay.state === 'ON' ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {relay.state === 'ON' ? (
                        <CheckCircle className="h-6 w-6 text-white" />
                      ) : isOnCooldown ? (
                        <Clock className="h-6 w-6 text-gray-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-gray-600" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">Relay {relay.id}</p>
                    <p className="text-xs text-gray-500">Pin {relay.pin}</p>
                    <p className={`text-xs px-2 py-1 rounded-full mt-1 ${
                      relay.state === 'ON'
                        ? 'bg-green-100 text-green-800'
                        : isOnCooldown
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {relay.state === 'ON' ? 'ON' : 
                       isOnCooldown ? `${Math.ceil(cooldownTime / 1000)}s` : 
                       'OFF'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 