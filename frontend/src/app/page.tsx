'use client'

import { useState, useEffect } from 'react'
import { Users, Settings, Zap, Activity } from 'lucide-react'
import Link from 'next/link'
import WashButtons from '@/components/WashButtons'
import { getCustomers, getWashTypes, testConnection } from '@/utils/api'

interface DashboardStats {
  totalCustomers: number
  activeMemberships: number
  totalWashTypes: number
  systemStatus: 'online' | 'offline' | 'loading'
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeMemberships: 0,
    totalWashTypes: 0,
    systemStatus: 'loading'
  })

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        const [customersRes, washTypesRes, statusRes] = await Promise.allSettled([
          getCustomers(),
          getWashTypes(),
          testConnection()
        ])

        setStats({
          totalCustomers: customersRes.status === 'fulfilled' ? (customersRes.value.customers?.length || 0) : 0,
          activeMemberships: customersRes.status === 'fulfilled' ? (customersRes.value.customers?.filter((c: any) => c.membership_status === 'active').length || 0) : 0,
          totalWashTypes: washTypesRes.status === 'fulfilled' ? (washTypesRes.value.washTypes?.length || 0) : 0,
          systemStatus: statusRes.status === 'fulfilled' && statusRes.value.success ? 'online' : 'offline'
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
        setStats(prev => ({ ...prev, systemStatus: 'offline' }))
      }
    }

    // Only fetch if we're in the browser
    if (typeof window !== 'undefined') {
      fetchStats()
    }
  }, [])

  const dashboardCards = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-blue-500',
      href: '/customers'
    },
    {
      title: 'Active Memberships',
      value: stats.activeMemberships,
      icon: Activity,
      color: 'bg-green-500',
      href: '/customers'
    },
    {
      title: 'Wash Types',
      value: stats.totalWashTypes,
      icon: Settings,
      color: 'bg-purple-500',
      href: '/wash-types'
    },
    {
      title: 'System Status',
      value: stats.systemStatus === 'loading' ? 'Loading...' : (stats.systemStatus === 'online' ? 'Online' : 'Offline'),
      icon: Zap,
      color: stats.systemStatus === 'loading' ? 'bg-gray-500' : (stats.systemStatus === 'online' ? 'bg-green-500' : 'bg-red-500'),
      href: '/control'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Car Wash Controller</h1>
              <p className="text-gray-600">Manage your car wash system</p>
            </div>
            <div className="flex space-x-4">
              <Link 
                href="/control"
                className="btn btn-primary btn-md"
              >
                Manual Control
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardCards.map((card, index) => (
            <Link key={index} href={card.href}>
              <div className="card p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${card.color} text-white`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Actions */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link 
                href="/customers/new"
                className="btn btn-primary btn-md w-full"
              >
                Add New Customer
              </Link>
              <Link 
                href="/wash-types/new"
                className="btn btn-secondary btn-md w-full"
              >
                Create Wash Type
              </Link>
              <Link 
                href="/control"
                className="btn btn-secondary btn-md w-full"
              >
                Manual Control Panel
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">ESP32 Connection</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  stats.systemStatus === 'loading' 
                    ? 'bg-gray-100 text-gray-800'
                    : stats.systemStatus === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {stats.systemStatus === 'loading' ? 'Checking...' : (stats.systemStatus === 'online' ? 'Connected' : 'Disconnected')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database</span>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">API Server</span>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Running
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Wash Controls */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Wash Controls</h2>
          <WashButtons />
        </div>
      </main>
    </div>
  )
} 