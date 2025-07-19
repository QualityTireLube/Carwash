'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Car, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getWashType, updateWashType } from '@/utils/api'

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

export default function EditWashTypePage() {
  const params = useParams()
  const router = useRouter()
  const washTypeId = params.id as string

  const [washType, setWashType] = useState<WashType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    relayId: '',
    isActive: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (washTypeId) {
      fetchWashType()
    }
  }, [washTypeId])

  const fetchWashType = async () => {
    try {
      setLoading(true)
      const result = await getWashType(washTypeId)
      const washTypeData = result.washType
      
      setWashType(washTypeData)
      setFormData({
        name: washTypeData.name || '',
        description: washTypeData.description || '',
        price: washTypeData.price?.toString() || '',
        duration: washTypeData.duration?.toString() || '',
        relayId: washTypeData.relayId?.toString() || '',
        isActive: washTypeData.isActive !== undefined ? washTypeData.isActive : true
      })
    } catch (error) {
      console.error('Error fetching wash type:', error)
      setError('Failed to load wash type data')
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
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        relayId: parseInt(formData.relayId)
      }
      
      await updateWashType(washTypeId, updateData)
      router.push(`/wash-types/${washTypeId}`)
    } catch (error) {
      console.error('Error updating wash type:', error)
      setError('Failed to update wash type. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wash type data...</p>
        </div>
      </div>
    )
  }

  if (error && !washType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Wash Type Not Found</h1>
          <p className="text-gray-600 mb-4">The wash type you are trying to edit does not exist.</p>
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
              <Link href={`/wash-types/${washTypeId}`} className="btn btn-secondary btn-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Wash Type</h1>
                <p className="text-gray-600">Update wash type information</p>
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
              <div className="bg-blue-500 rounded-full p-3 mr-4">
                <Car className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Wash Type Information</h2>
                <p className="text-sm text-gray-600">Update the wash type details below</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Wash Type Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter wash type name"
              />
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what this wash type includes (optional)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Price Field */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  Price ($) *
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              {/* Duration Field */}
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (seconds) *
                </label>
                <input
                  type="number"
                  id="duration"
                  name="duration"
                  required
                  min="1"
                  value={formData.duration}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="120"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.duration && parseInt(formData.duration) > 0 
                    ? `${Math.floor(parseInt(formData.duration) / 60)}:${(parseInt(formData.duration) % 60).toString().padStart(2, '0')}` 
                    : 'Duration in minutes:seconds format'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Relay ID Field */}
              <div>
                <label htmlFor="relayId" className="block text-sm font-medium text-gray-700 mb-2">
                  Relay Channel *
                </label>
                <select
                  id="relayId"
                  name="relayId"
                  required
                  value={formData.relayId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Relay Channel</option>
                  <option value="1">Relay 1</option>
                  <option value="2">Relay 2</option>
                  <option value="3">Relay 3</option>
                  <option value="4">Relay 4</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">ESP32 relay channel to trigger</p>
              </div>

              {/* Active Status Field */}
              <div>
                <label htmlFor="isActive" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-900">
                    Active wash type
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.isActive ? 'Available for selection' : 'Hidden from customers'}
                </p>
              </div>
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
                href={`/wash-types/${washTypeId}`}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className={`btn btn-primary btn-md ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
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