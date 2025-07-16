'use client'

import { useState, useEffect } from 'react'
import { Zap, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
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

export default function ControlPanel() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastTriggered, setLastTriggered] = useState<number | null>(null)

  useEffect(() => {
    fetchSystemStatus()
    const interval = setInterval(fetchSystemStatus, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/status`)
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching system status:', error)
    }
  }

  const triggerRelay = async (relayId: number) => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/${relayId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setLastTriggered(relayId)
        setTimeout(() => setLastTriggered(null), 2000) // Clear after 2 seconds
        fetchSystemStatus() // Refresh status
      } else {
        console.error('Failed to trigger relay')
      }
    } catch (error) {
      console.error('Error triggering relay:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetAll = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/5`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setLastTriggered(5)
        setTimeout(() => setLastTriggered(null), 2000)
        fetchSystemStatus()
      }
    } catch (error) {
      console.error('Error resetting system:', error)
    } finally {
      setLoading(false)
    }
  }

  const washTypes = [
    { id: 1, name: 'Basic Wash', description: 'Exterior wash with soap and rinse', duration: '2 min' },
    { id: 2, name: 'Premium Wash', description: 'Basic wash plus tire cleaning and wax', duration: '3 min' },
    { id: 3, name: 'Deluxe Wash', description: 'Premium wash plus interior vacuum and window cleaning', duration: '5 min' },
    { id: 4, name: 'Ultimate Wash', description: 'Complete wash with all services and detailing', duration: '10 min' },
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
              {washTypes.map((washType) => (
                <div key={washType.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{washType.name}</h3>
                      <p className="text-sm text-gray-600">{washType.description}</p>
                      <p className="text-xs text-gray-500">Duration: {washType.duration}</p>
                    </div>
                    <button
                      onClick={() => triggerRelay(washType.id)}
                      disabled={loading}
                      className={`btn btn-primary btn-sm ${
                        lastTriggered === washType.id ? 'bg-green-600' : ''
                      }`}
                    >
                      {lastTriggered === washType.id ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      {lastTriggered === washType.id ? 'Triggered' : 'Trigger'}
                    </button>
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
              ))}
            </div>
          </div>

          {/* Manual Controls */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Manual Controls</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((relayId) => (
                  <button
                    key={relayId}
                    onClick={() => triggerRelay(relayId)}
                    disabled={loading}
                    className={`btn btn-secondary btn-md ${
                      lastTriggered === relayId ? 'bg-green-600 text-white' : ''
                    }`}
                  >
                    {lastTriggered === relayId ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Relay {relayId}
                  </button>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <button
                  onClick={resetAll}
                  disabled={loading}
                  className={`btn btn-danger btn-md w-full ${
                    lastTriggered === 5 ? 'bg-green-600' : ''
                  }`}
                >
                  {lastTriggered === 5 ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  {lastTriggered === 5 ? 'Reset Complete' : 'Reset All'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Relay Status */}
        {systemStatus?.relays && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Relay Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {systemStatus.relays.map((relay) => (
                <div key={relay.id} className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 ${
                    relay.state === 'ON' ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {relay.state === 'ON' ? (
                      <CheckCircle className="h-6 w-6 text-white" />
                    ) : (
                      <XCircle className="h-6 w-6 text-gray-600" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900">Relay {relay.id}</p>
                  <p className="text-xs text-gray-500">Pin {relay.pin}</p>
                  <p className={`text-xs px-2 py-1 rounded-full mt-1 ${
                    relay.state === 'ON'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {relay.state}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 