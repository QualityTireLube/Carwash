'use client'

import { useState, useEffect } from 'react'
import { Settings, Plus, Search, Eye, Edit, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getWashTypes, deleteWashType } from '@/utils/api'

interface WashType {
  id: number
  name: string
  description: string
  price: number
  duration: number
  relayId: number
  is_active: boolean
  created_at: string
}

export default function WashTypesPage() {
  const router = useRouter()
  const [washTypes, setWashTypes] = useState<WashType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

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

  const handleDelete = async (washType: WashType) => {
    const confirmMessage = `Are you sure you want to delete wash type "${washType.name}"?\n\nThis action cannot be undone and will affect all related wash sessions.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setDeleting(washType.id.toString())
    try {
      await deleteWashType(washType.id.toString())
      // Refresh the wash types list
      const response = await getWashTypes()
      setWashTypes(response.washTypes || [])
    } catch (error) {
      console.error('Error deleting wash type:', error)
      alert('Failed to delete wash type. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

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
              <div key={washType.id} className="card p-6 relative group">
                <div 
                  className="cursor-pointer"
                  onClick={() => router.push(`/wash-types/${washType.id}`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {washType.name}
                      </h3>
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
                      <span className="font-medium text-gray-900">${washType.price && !isNaN(Number(washType.price)) ? Number(washType.price).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-gray-900">{Math.floor(washType.duration / 60)}:{(washType.duration % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Relay:</span>
                      <span className="font-medium text-gray-900">#{washType.relayId || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                  <Link
                    href={`/wash-types/${washType.id}`}
                    className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                    title="View Details"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/wash-types/${washType.id}/edit`}
                    className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded"
                    title="Edit Wash Type"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(washType)
                    }}
                    disabled={deleting === washType.id.toString()}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded disabled:opacity-50"
                    title="Delete Wash Type"
                  >
                    {deleting === washType.id.toString() ? (
                      <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
} 