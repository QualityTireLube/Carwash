'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, CreditCard, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getMembership, updateMembership, getWashTypes } from '@/utils/api'

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

interface WashType {
  id: string
  name: string
  description: string
  duration: number
  price: number
  relayId: number
  isActive: boolean
}

export default function EditMembershipPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const membershipId = params.membershipId as string

  const [membership, setMembership] = useState<Membership | null>(null)
  const [washTypes, setWashTypes] = useState<WashType[]>([])
  const [formData, setFormData] = useState({
    status: 'active',
    endDate: '',
    notes: '',
    price: '',
    rfidTag: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (membershipId) {
      fetchData()
    }
  }, [membershipId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [membershipRes, washTypesRes] = await Promise.all([
        getMembership(membershipId),
        getWashTypes()
      ])
      
      const membershipData = membershipRes.membership
      setMembership(membershipData)
      setWashTypes(washTypesRes.washTypes?.filter((wt: WashType) => wt.isActive) || [])
      
      // Populate form with existing data
      setFormData({
        status: membershipData.status || 'active',
        endDate: membershipData.endDate ? new Date(membershipData.endDate).toISOString().split('T')[0] : '',
        notes: membershipData.notes || '',
        price: membershipData.price ? membershipData.price.toString() : '',
        rfidTag: membershipData.rfidTag || ''
      })
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load membership data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const updateData = {
        status: formData.status,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        rfidTag: formData.rfidTag || undefined
      }
      
      await updateMembership(membershipId, updateData)
      router.push(`/customers/${customerId}/memberships/${membershipId}`)
    } catch (error: any) {
      console.error('Error updating membership:', error)
      setError('Failed to update membership. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
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

  if (error && !membership) {
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
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href={`/customers/${customerId}`} className="btn btn-primary">
              Return to Customer
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!membership) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-6">
            <Link href={`/customers/${customerId}/memberships/${membershipId}`} className="btn btn-secondary btn-sm mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Membership
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Membership</h1>
              <p className="text-gray-600">{membership.customer.name} • {membership.washType.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="bg-green-500 rounded-full p-3 mr-4">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Membership Details</h2>
                <p className="text-sm text-gray-600">Update membership settings and information</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-6 border-b border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Read-only Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Membership Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Customer</label>
                  <p className="text-sm text-gray-900">{membership.customer.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Wash Type</label>
                  <p className="text-sm text-gray-900">{membership.washType.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Billing Cycle</label>
                  <p className="text-sm text-gray-900 capitalize">{membership.billingCycle}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Start Date</label>
                  <p className="text-sm text-gray-900">
                    {new Date(membership.startDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Set the current status of this membership
              </p>
            </div>

            {/* Price Override */}
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                Price Override
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="price"
                  name="price"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use default wash type price
              </p>
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for open-ended membership
              </p>
            </div>

            {/* RFID Tag */}
            <div>
              <label htmlFor="rfidTag" className="block text-sm font-medium text-gray-700 mb-2">
                RFID Tag
              </label>
              <input
                type="text"
                id="rfidTag"
                name="rfidTag"
                value={formData.rfidTag}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Enter RFID tag number"
              />
              <p className="text-xs text-gray-500 mt-1">
                Assign an RFID tag for automatic wash activation
              </p>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add any additional notes about this membership..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional notes for internal reference
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <Link
                href={`/customers/${customerId}/memberships/${membershipId}`}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-md"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
} 