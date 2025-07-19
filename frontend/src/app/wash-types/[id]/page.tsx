'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Car, Clock, DollarSign, Zap, Edit, Trash2, AlertTriangle, Activity } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getWashType, deleteWashType, getWashSessions } from '@/utils/api'

interface WashType {
  id: string
  name: string
  description: string
  duration: number
  price: number
  relayId: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface WashSession {
  id: string
  customerId: string
  startedAt: string
  completedAt?: string
  status: string
  customer: {
    name: string
    email: string
  }
}

export default function WashTypeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const washTypeId = params.id as string

  const [washType, setWashType] = useState<WashType | null>(null)
  const [recentSessions, setRecentSessions] = useState<WashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (washTypeId) {
      fetchWashTypeData()
    }
  }, [washTypeId])

  const fetchWashTypeData = async () => {
    try {
      setLoading(true)
      const [washTypeRes, sessionsRes] = await Promise.all([
        getWashType(washTypeId),
        getWashSessions({ limit: 10 }) // Get recent sessions to filter by wash type
      ])
      
      setWashType(washTypeRes.washType)
      // Filter sessions for this wash type
      const filteredSessions = sessionsRes.sessions?.filter(
        (session: WashSession & { washTypeId: string }) => session.washTypeId === washTypeId
      ) || []
      setRecentSessions(filteredSessions.slice(0, 5)) // Show only 5 most recent
    } catch (error) {
      console.error('Error fetching wash type data:', error)
      setError('Failed to load wash type data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!washType) return

    const confirmMessage = `Are you sure you want to delete wash type "${washType.name}"?\n\nThis action cannot be undone and will affect all related wash sessions.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setDeleting(true)
    try {
      await deleteWashType(washTypeId)
      router.push('/wash-types')
    } catch (error) {
      console.error('Error deleting wash type:', error)
      alert('Failed to delete wash type. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'cancelled':
        return 'text-gray-600 bg-gray-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
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
          <p className="text-gray-600">Loading wash type details...</p>
        </div>
      </div>
    )
  }

  if (error || !washType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Wash Type Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The wash type you are looking for does not exist.'}</p>
          <Link href="/wash-types" className="btn btn-primary btn-md">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Wash Types
          </Link>
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
            <div className="flex items-center space-x-4">
              <Link href="/wash-types" className="btn btn-secondary btn-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{washType.name}</h1>
                <p className="text-gray-600">Wash Type Details</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link 
                href={`/wash-types/${washTypeId}/edit`}
                className="btn btn-primary btn-md"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Wash Type
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-danger btn-md"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Wash Type
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Wash Type Information */}
          <div className="lg:col-span-2">
            <div className="card p-6">
              <div className="flex items-center mb-6">
                <div className="bg-blue-500 rounded-full p-3 mr-4">
                  <Car className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Wash Type Information</h2>
                  <p className="text-sm text-gray-600">Service details and specifications</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Name</label>
                  <p className="text-lg font-semibold text-gray-900">{washType.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                      washType.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {washType.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-sm text-gray-900 mt-1">{washType.description}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Price
                  </label>
                  <p className="text-2xl font-bold text-gray-900">${washType.price.toFixed(2)}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    Duration
                  </label>
                  <p className="text-2xl font-bold text-gray-900">{formatDuration(washType.duration)}</p>
                  <p className="text-sm text-gray-500">{washType.duration} seconds</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Zap className="h-4 w-4 mr-1" />
                    Relay Channel
                  </label>
                  <p className="text-2xl font-bold text-gray-900">#{washType.relayId}</p>
                  <p className="text-sm text-gray-500">ESP32 Relay Channel</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-sm text-gray-900">{new Date(washType.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats and Recent Activity */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Quick Stats */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  href="/wash-sessions/start"
                  className="btn btn-primary btn-md w-full"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start This Wash
                </Link>
                <Link
                  href="/wash-sessions"
                  className="btn btn-secondary btn-md w-full"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  View All Sessions
                </Link>
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h3>
              
              {recentSessions.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No recent sessions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div key={session.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{session.customer.name}</p>
                          <p className="text-xs text-gray-500">{session.customer.email}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(session.startedAt).toLocaleDateString()} at {new Date(session.startedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 