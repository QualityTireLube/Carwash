'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, User, Mail, Phone, Calendar, Edit, Trash2, Activity, AlertTriangle, CreditCard, Plus } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getCustomer, deleteCustomer, getCustomerWashSessions, getCustomerMemberships, deleteMembership } from '@/utils/api'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  rfidTag?: string
  membershipStatus: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  createdAt: string
  updatedAt: string
}

interface WashSession {
  id: string
  washTypeId: string
  relayId: number
  startedAt: string
  completedAt?: string
  status: string
  notes: string
  washType: {
    name: string
    description: string
    price: number
  }
}

interface Membership {
  id: string
  customerId: string
  washTypeId: string
  status: string
  startDate: string
  endDate?: string
  billingCycle: string
  price: number
  notes?: string
  rfidTag?: string
  createdAt: string
  washType: {
    name: string
    description: string
    duration: number
    relayId: number
  }
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [washSessions, setWashSessions] = useState<WashSession[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customerId) {
      fetchCustomerData()
    }
  }, [customerId])

  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      const [customerRes, sessionsRes, membershipsRes] = await Promise.all([
        getCustomer(customerId),
        getCustomerWashSessions(customerId, 20),
        getCustomerMemberships(customerId)
      ])
      
      setCustomer(customerRes.customer)
      setWashSessions(sessionsRes.sessions || [])
      setMemberships(membershipsRes.memberships || [])
    } catch (error) {
      console.error('Error fetching customer data:', error)
      setError('Failed to load customer data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!customer) return

    const confirmMessage = `Are you sure you want to delete customer "${customer.name}"?\n\nThis action cannot be undone and will remove all associated data.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setDeleting(true)
    try {
      await deleteCustomer(customerId)
      router.push('/customers')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Failed to delete customer. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteMembership = async (membership: Membership) => {
    const confirmMessage = `Are you sure you want to delete this membership?\n\nWash Type: ${membership.washType.name}\nStatus: ${membership.status}\n\nThis action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      await deleteMembership(membership.id)
      // Refresh the memberships list
      const membershipsRes = await getCustomerMemberships(customerId)
      setMemberships(membershipsRes.memberships || [])
    } catch (error) {
      console.error('Error deleting membership:', error)
      alert('Failed to delete membership. Please try again.')
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

  const getMembershipStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customer details...</p>
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Customer Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The customer you are looking for does not exist.'}</p>
          <Link href="/customers" className="btn btn-primary btn-md">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
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
              <Link href="/customers" className="btn btn-secondary btn-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                <p className="text-gray-600">Customer Details</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link 
                href={`/customers/${customerId}/edit`}
                className="btn btn-primary btn-md"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Customer
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
                    Delete Customer
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
          
          {/* Customer Information */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card p-6">
              <div className="flex items-center mb-6">
                <div className="bg-blue-500 rounded-full p-3 mr-4">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Customer Information</h2>
                  <p className="text-sm text-gray-600">Personal details and membership status</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-sm text-gray-900 font-medium">{customer.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Mail className="h-4 w-4 mr-1" />
                    Email Address
                  </label>
                  <p className="text-sm text-gray-900">{customer.email}</p>
                </div>

                {customer.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center">
                      <Phone className="h-4 w-4 mr-1" />
                      Phone Number
                    </label>
                    <p className="text-sm text-gray-900">{customer.phone}</p>
                  </div>
                )}

                {customer.rfidTag && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">RFID Tag</label>
                    <p className="text-sm text-gray-900 font-mono">{customer.rfidTag}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">Membership Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMembershipStatusColor(customer.membershipStatus)}`}>
                      {customer.membershipStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Member Since
                  </label>
                  <p className="text-sm text-gray-900">{new Date(customer.createdAt).toLocaleDateString()}</p>
                </div>

                {customer.stripeCustomerId && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Stripe Customer ID</label>
                    <p className="text-sm text-gray-900 font-mono">{customer.stripeCustomerId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Memberships */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="bg-green-500 rounded-full p-3 mr-4">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Memberships</h2>
                    <p className="text-sm text-gray-600">Active wash type memberships</p>
                  </div>
                </div>
                <Link 
                  href={`/customers/${customerId}/memberships/new`}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Membership
                </Link>
              </div>

              {memberships.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No memberships yet</p>
                  <Link 
                    href={`/customers/${customerId}/memberships/new`}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Membership
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((membership) => (
                    <div key={membership.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div 
                          className="cursor-pointer flex-1"
                          onClick={() => router.push(`/customers/${customerId}/memberships/${membership.id}`)}
                        >
                          <h3 className="font-medium text-gray-900 hover:text-blue-600 transition-colors">{membership.washType.name}</h3>
                          <p className="text-sm text-gray-600">{membership.washType.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMembershipStatusColor(membership.status)}`}>
                            {membership.status}
                          </span>
                          <div className="flex items-center space-x-1">
                            <Link
                              href={`/customers/${customerId}/memberships/${membership.id}/edit`}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title="Edit Membership"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteMembership(membership)
                              }}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete Membership"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Price:</span>
                          <span className="ml-1 font-medium text-gray-900">
                            ${membership.price && !isNaN(Number(membership.price)) ? Number(membership.price).toFixed(2) : 'N/A'}/{membership.billingCycle}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Started:</span>
                          <span className="ml-1 text-gray-900">
                            {new Date(membership.startDate).toLocaleDateString()}
                          </span>
                        </div>
                        {membership.rfidTag && (
                          <div className="col-span-2">
                            <span className="text-gray-500">RFID Tag:</span>
                            <span className="ml-1 text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                              {membership.rfidTag}
                            </span>
                          </div>
                        )}
                        {membership.endDate && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Ends:</span>
                            <span className="ml-1 text-gray-900">
                              {new Date(membership.endDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wash Sessions History */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-blue-500 mr-2" />
                    <h2 className="text-xl font-semibold text-gray-900">
                      Wash Sessions ({washSessions.length})
                    </h2>
                  </div>
                  <Link 
                    href="/wash-sessions/start"
                    className="btn btn-primary btn-sm"
                  >
                    Start New Wash
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                {washSessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No wash sessions yet</h3>
                    <p className="text-gray-600 mb-4">This customer hasn't had any wash sessions.</p>
                    <Link href="/wash-sessions/start" className="btn btn-primary btn-md">
                      Start First Wash
                    </Link>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Wash Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
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
                      {washSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{session.washType.name}</div>
                              <div className="text-sm text-gray-500">{session.washType.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                              {session.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div>{new Date(session.startedAt).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">{new Date(session.startedAt).toLocaleTimeString()}</div>
                            </div>
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
          </div>
        </div>
      </main>
    </div>
  )
} 