'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Edit, Trash2, CreditCard, Calendar, DollarSign, Tag, FileText, User, Car, Activity } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getMembership, deleteMembership } from '@/utils/api'

interface Membership {
  id: string
  customerId: string
  washTypeId: string
  status: string
  startDate: string
  endDate?: string
  billingCycle: string
  price: number
  stripeSubscriptionId?: string
  notes?: string
  rfidTag?: string
  createdAt: string
  updatedAt: string
  customer: {
    name: string
    email: string
  }
  washType: {
    name: string
    description: string
  }
}

export default function MembershipDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const membershipId = params.membershipId as string

  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (membershipId) {
      fetchMembership()
    }
  }, [membershipId])

  const fetchMembership = async () => {
    try {
      setLoading(true)
      const result = await getMembership(membershipId)
      setMembership(result.membership)
    } catch (error) {
      console.error('Error fetching membership:', error)
      setError('Failed to load membership data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!membership) return

    const confirmMessage = `Are you sure you want to delete this membership?\n\nCustomer: ${membership.customer.name}\nWash Type: ${membership.washType.name}\n\nThis action cannot be undone.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setDeleting(true)
    try {
      await deleteMembership(membershipId)
      router.push(`/customers/${customerId}`)
    } catch (error) {
      console.error('Error deleting membership:', error)
      alert('Failed to delete membership. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const getMembershipStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading membership...</p>
        </div>
      </div>
    )
  }

  if (error || !membership) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-6">
              <Link href={`/customers/${customerId}`} className="btn btn-secondary btn-sm mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Customer
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Membership Not Found</h1>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-8 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Membership Not Found</h3>
            <p className="text-gray-600 mb-4">{error || 'The membership you are looking for does not exist.'}</p>
            <Link href={`/customers/${customerId}`} className="btn btn-primary">
              Return to Customer
            </Link>
          </div>
        </main>
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
              <Link href={`/customers/${customerId}`} className="btn btn-secondary btn-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Customer
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Membership Details</h1>
                <p className="text-gray-600">{membership.customer.name} • {membership.washType.name}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link 
                href={`/customers/${customerId}/memberships/${membershipId}/edit`}
                className="btn btn-primary btn-md"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Membership
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
                    Delete Membership
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
          
          {/* Main Membership Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Membership Overview */}
            <div className="card p-6">
              <div className="flex items-center mb-6">
                <div className="bg-green-500 rounded-full p-3 mr-4">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Membership Overview</h2>
                  <p className="text-sm text-gray-600">Core membership information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Customer
                  </label>
                  <p className="text-sm text-gray-900">{membership.customer.name}</p>
                  <p className="text-xs text-gray-500">{membership.customer.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Car className="h-4 w-4 mr-1" />
                    Wash Type
                  </label>
                  <p className="text-sm text-gray-900">{membership.washType.name}</p>
                  <p className="text-xs text-gray-500">{membership.washType.description}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Activity className="h-4 w-4 mr-1" />
                    Status
                  </label>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMembershipStatusColor(membership.status)}`}>
                    {membership.status}
                  </span>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Price
                  </label>
                  <p className="text-sm text-gray-900">
                    ${membership.price && !isNaN(Number(membership.price)) ? Number(membership.price).toFixed(2) : '0.00'}/{membership.billingCycle}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Start Date
                  </label>
                  <p className="text-sm text-gray-900">
                    {new Date(membership.startDate).toLocaleDateString()}
                  </p>
                </div>

                {membership.endDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      End Date
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(membership.endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {membership.rfidTag && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center">
                      <Tag className="h-4 w-4 mr-1" />
                      RFID Tag
                    </label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                      {membership.rfidTag}
                    </p>
                  </div>
                )}

                {membership.notes && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      Notes
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                      {membership.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href={`/customers/${customerId}/memberships/${membershipId}/edit`}
                  className="w-full btn btn-primary btn-sm justify-start"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Membership
                </Link>
                <Link 
                  href={`/customers/${customerId}`}
                  className="w-full btn btn-secondary btn-sm justify-start"
                >
                  <User className="h-4 w-4 mr-2" />
                  View Customer
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full btn btn-danger btn-sm justify-start"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Membership
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Membership Timeline */}
            <div className="card p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Membership Created</p>
                    <p className="text-xs text-gray-500">
                      {new Date(membership.createdAt).toLocaleDateString()} at {new Date(membership.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                
                {membership.updatedAt !== membership.createdAt && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Last Updated</p>
                      <p className="text-xs text-gray-500">
                        {new Date(membership.updatedAt).toLocaleDateString()} at {new Date(membership.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Current Status</p>
                    <p className="text-xs text-gray-500 capitalize">{membership.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stripe Information */}
            {membership.stripeSubscriptionId && (
              <div className="card p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
                <div>
                  <label className="text-sm font-medium text-gray-500">Stripe Subscription ID</label>
                  <p className="text-xs text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded mt-1 break-all">
                    {membership.stripeSubscriptionId}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 