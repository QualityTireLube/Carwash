'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, User, Car, Clock, DollarSign, Zap, CheckCircle, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { getCustomers, getWashTypes, startWashSession, getCustomerMemberships } from '@/utils/api'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  membershipStatus: string
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

interface Membership {
  id: string
  washTypeId: string
  status: string
  washType: {
    name: string
  }
}

export default function StartWashPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [washTypes, setWashTypes] = useState<WashType[]>([])
  const [customerMemberships, setCustomerMemberships] = useState<Membership[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWashType, setSelectedWashType] = useState<WashType | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [washStarted, setWashStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [customersRes, washTypesRes] = await Promise.all([
        getCustomers(),
        getWashTypes()
      ])
      
      setCustomers(customersRes.customers || [])
      setWashTypes(washTypesRes.washTypes?.filter((wt: WashType) => wt.isActive) || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load data')
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setSelectedWashType(null) // Reset wash type when customer changes
    
    try {
      const membershipsRes = await getCustomerMemberships(customer.id)
      setCustomerMemberships(membershipsRes.memberships || [])
    } catch (error) {
      console.error('Error fetching customer memberships:', error)
      setCustomerMemberships([])
    }
  }

  const hasMembership = (washTypeId: string) => {
    return customerMemberships.find(
      membership => membership.washTypeId === washTypeId && membership.status === 'active'
    )
  }

  const handleStartWash = async () => {
    if (!selectedCustomer || !selectedWashType) {
      setError('Please select both a customer and wash type')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await startWashSession(
        selectedCustomer.id,
        selectedWashType.id,
        `${selectedWashType.name} wash for ${selectedCustomer.name}`
      )

      if (result.success) {
        setWashStarted(true)
        setTimeout(() => {
          window.location.href = '/wash-sessions'
        }, 3000)
      } else {
        setError(result.error || 'Failed to start wash')
      }
    } catch (error) {
      console.error('Error starting wash:', error)
      setError('Failed to start wash. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (washStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Wash Started!</h1>
          <p className="text-gray-600 mb-4">
            {selectedWashType?.name} wash has been started for {selectedCustomer?.name}
          </p>
          <p className="text-sm text-gray-500">
            Redirecting to wash sessions...
          </p>
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
              <h1 className="text-3xl font-bold text-gray-900">Start Wash Session</h1>
              <p className="text-gray-600">Select a customer and wash type to begin</p>
            </div>
            <Link href="/wash-sessions" className="btn btn-secondary btn-md">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Customer Selection */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Select Customer
            </h2>
            
            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Customer List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {customerSearch ? 'No customers found matching your search.' : 'No customers available.'}
                </p>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedCustomer?.id === customer.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{customer.name}</h3>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                        {customer.phone && (
                          <p className="text-sm text-gray-500">{customer.phone}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        customer.membershipStatus === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {customer.membershipStatus}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Wash Type Selection */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Car className="h-5 w-5 mr-2" />
              Select Wash Type
            </h2>
            
            <div className="space-y-4">
              {washTypes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No wash types available.</p>
              ) : (
                washTypes.map((washType) => (
                  <div
                    key={washType.id}
                    onClick={() => setSelectedWashType(washType)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedWashType?.id === washType.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">{washType.name}</h3>
                        {selectedCustomer && hasMembership(washType.id) && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Member
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">Relay {washType.relayId}</span>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{washType.description}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="font-medium">${washType.price.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          <span>{Math.floor(washType.duration / 60)}:{(washType.duration % 60).toString().padStart(2, '0')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Start Wash Section */}
        <div className="mt-8 card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Start Wash</h2>
          
          {/* Selected Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Selected Customer</h3>
                {selectedCustomer ? (
                  <div>
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No customer selected</p>
                )}
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Selected Wash Type</h3>
                {selectedWashType ? (
                  <div>
                    <p className="text-sm font-medium">{selectedWashType.name}</p>
                    <p className="text-sm text-gray-600">
                      ${selectedWashType.price.toFixed(2)} • {Math.floor(selectedWashType.duration / 60)}:{(selectedWashType.duration % 60).toString().padStart(2, '0')} • Relay {selectedWashType.relayId}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No wash type selected</p>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStartWash}
            disabled={!selectedCustomer || !selectedWashType || loading}
            className={`btn btn-primary btn-lg w-full ${
              (!selectedCustomer || !selectedWashType || loading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
                Starting Wash...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Start Wash & Trigger Relay
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  )
} 