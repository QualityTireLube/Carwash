'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, CreditCard, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getCustomer, getWashTypes, createMembership } from '@/utils/api'

interface Customer {
  id: string
  name: string
  email: string
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

export default function NewMembershipPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [washTypes, setWashTypes] = useState<WashType[]>([])
  const [formData, setFormData] = useState({
    washTypeId: '',
    status: 'active',
    billingCycle: 'monthly',
    price: '',
    endDate: '',
    notes: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customerId) {
      fetchData()
    }
  }, [customerId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [customerRes, washTypesRes] = await Promise.all([
        getCustomer(customerId),
        getWashTypes()
      ])
      
      setCustomer(customerRes.customer)
      setWashTypes(washTypesRes.washTypes?.filter((wt: WashType) => wt.isActive) || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const membershipData = {
        customerId,
        washTypeId: formData.washTypeId,
        status: formData.status,
        billingCycle: formData.billingCycle,
        price: formData.price ? parseFloat(formData.price) : undefined,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined
      }
      
      await createMembership(membershipData)
      router.push(`/customers/${customerId}`)
    } catch (error: any) {
      console.error('Error creating membership:', error)
      
      // Handle specific error cases
      if (error.message?.includes('already has an active membership')) {
        setError('Customer already has an active membership for this wash type')
      } else {
        setError('Failed to create membership. Please try again.')
      }
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

  const selectedWashType = washTypes.find(wt => wt.id === formData.washTypeId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h1>
          <p className="text-gray-600 mb-4">Unable to load customer or wash type information.</p>
          <Link href={`/customers/${customerId}`} className="btn btn-primary btn-md">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customer
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
              <Link href={`/customers/${customerId}`} className="btn btn-secondary btn-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Add Membership</h1>
                <p className="text-gray-600">Create a new membership for {customer?.name}</p>
              </div>
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
                <p className="text-sm text-gray-600">Configure the membership settings</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Wash Type Selection */}
            <div>
              <label htmlFor="washTypeId" className="block text-sm font-medium text-gray-700 mb-2">
                Wash Type *
              </label>
              <select
                id="washTypeId"
                name="washTypeId"
                required
                value={formData.washTypeId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a wash type</option>
                {washTypes.map((washType) => (
                  <option key={washType.id} value={washType.id}>
                    {washType.name} - ${washType.price.toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedWashType && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedWashType.description} • {Math.floor(selectedWashType.duration / 60)}:{(selectedWashType.duration % 60).toString().padStart(2, '0')} • Relay {selectedWashType.relayId}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status */}
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
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Billing Cycle */}
              <div>
                <label htmlFor="billingCycle" className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Cycle *
                </label>
                <select
                  id="billingCycle"
                  name="billingCycle"
                  required
                  value={formData.billingCycle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custom Price */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Price (optional)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={selectedWashType ? selectedWashType.price.toFixed(2) : "0.00"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to use wash type default price
                </p>
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (optional)
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
                  Leave empty for indefinite membership
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add any additional notes about this membership..."
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Link 
                href={`/customers/${customerId}`}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || !formData.washTypeId}
                className={`btn btn-primary btn-md ${(saving || !formData.washTypeId) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Membership
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