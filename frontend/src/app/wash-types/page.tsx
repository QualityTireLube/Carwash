'use client'

import { useState, useEffect } from 'react'
import { Settings, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { getWashTypes } from '@/utils/api'

interface WashType {
  id: number
  name: string
  description: string
  price: number
  duration: number
  is_active: boolean
  created_at: string
}

export default function WashTypesPage() {
  const [washTypes, setWashTypes] = useState<WashType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchWashTypes = async () => {
      try {
        const response = await getWashTypes()
        setWashTypes(response.washTypes || [])
      } catch (error) {
        console.error('Error fetching wash types:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWashTypes()
  }, [])

  const filteredWashTypes = washTypes.filter(washType =>
    washType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    washType.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Wash Types</h1>
              <p className="text-gray-600">Manage your wash service types</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/wash-types/new"
                className="btn btn-primary btn-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Wash Type
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search wash types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Wash Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading wash types...</p>
            </div>
          ) : filteredWashTypes.length === 0 ? (
            <div className="col-span-full p-8 text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No wash types found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating your first wash type.'}
              </p>
              {!searchTerm && (
                <Link href="/wash-types/new" className="btn btn-primary btn-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wash Type
                </Link>
              )}
            </div>
          ) : (
            filteredWashTypes.map((washType) => (
              <div key={washType.id} className="card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{washType.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{washType.description}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    washType.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {washType.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-medium text-gray-900">${washType.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">{washType.duration} minutes</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
} 