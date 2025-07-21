'use client'

import { useState, useEffect } from 'react'
import { Activity, Plus, Clock, User, Car, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react'
import Link from 'next/link'
import { getWashSessions, getActiveWashSessions, completeWashSession, cancelWashSession } from '@/utils/api'

interface WashSession {
  id: string
  customerId: string
  washTypeId: string
  relayId: number
  startedAt: string
  completedAt?: string
  status: 'active' | 'completed' | 'cancelled' | 'error'
  notes: string
  customer: {
    name: string
    email: string
  }
  washType: {
    name: string
    description: string
    duration: number
    price: number
  }
}

interface ActiveSession extends WashSession {
  elapsedSeconds: number
}

export default function WashSessionsPage() {
  const [sessions, setSessions] = useState<WashSession[]>([])
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled' | 'error'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // Set up polling for active sessions
    const interval = setInterval(fetchActiveSessions, 15000) // Update every 15 seconds (reduced for rate limiting)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [filter])

  const fetchData = async () => {
    await Promise.all([fetchSessions(), fetchActiveSessions()])
    setLoading(false)
  }

  const fetchSessions = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : undefined
      const result = await getWashSessions(params)
      setSessions(result.sessions || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const fetchActiveSessions = async () => {
    try {
      const result = await getActiveWashSessions()
      setActiveSessions(result.activeSessions || [])
    } catch (error) {
      console.error('Error fetching active sessions:', error)
    }
  }

  const handleCompleteSession = async (sessionId: string) => {
    setActionLoading(sessionId)
    try {
      await completeWashSession(sessionId, 'Manually completed')
      await fetchData() // Refresh data
    } catch (error) {
      console.error('Error completing session:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelSession = async (sessionId: string) => {
    const reason = prompt('Enter cancellation reason (optional):')
    setActionLoading(sessionId)
    try {
      await cancelWashSession(sessionId, reason || 'Cancelled by operator')
      await fetchData() // Refresh data
    } catch (error) {
      console.error('Error cancelling session:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wash sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Wash Sessions</h1>
              <p className="text-gray-600">Monitor and manage customer wash sessions</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/wash-sessions/start"
                className="btn btn-primary btn-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Start New Wash
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-500" />
              Active Wash Sessions ({activeSessions.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((session) => (
                <div key={session.id} className="card p-4 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{session.customer.name}</h3>
                      <p className="text-sm text-gray-600">{session.washType.name}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(session.status)}
                      <span className="text-sm font-medium text-blue-600">
                        {formatDuration(session.elapsedSeconds)} / {formatDuration(session.washType.duration)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${Math.min((session.elapsedSeconds / session.washType.duration) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCompleteSession(session.id)}
                      disabled={actionLoading === session.id}
                      className="btn btn-sm btn-primary flex-1"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleCancelSession(session.id)}
                      disabled={actionLoading === session.id}
                      className="btn btn-sm btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session History */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Session History</h2>
              
              {/* Status Filter */}
              <div className="flex space-x-2">
                {['all', 'active', 'completed', 'cancelled', 'error'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status as any)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      filter === status
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {sessions.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No wash sessions found</h3>
                <p className="text-gray-600 mb-4">
                  {filter === 'all' 
                    ? 'No wash sessions have been created yet.' 
                    : `No ${filter} wash sessions found.`}
                </p>
                <Link href="/wash-sessions/start" className="btn btn-primary btn-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Start First Wash
                </Link>
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Wash Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Relay
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.customer.name}</div>
                          <div className="text-sm text-gray-500">{session.customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.washType.name}</div>
                          <div className="text-sm text-gray-500">{session.washType.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(session.status)}
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                            {session.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(session.startedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(session.washType.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${session.washType.price && !isNaN(Number(session.washType.price)) ? Number(session.washType.price).toFixed(2) : '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.relayId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 