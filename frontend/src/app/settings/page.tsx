'use client'

import { useState, useEffect } from 'react'
import { Settings, ArrowLeft, Play, CheckCircle, XCircle, Clock, AlertTriangle, RotateCcw, Database, TestTube, Bug } from 'lucide-react'
import Link from 'next/link'
import { getTestSuites, runAllTests, runTestSuite, runSpecificTest } from '@/utils/api'

interface TestSuite {
  id: string
  name: string
  description: string
  testCount: number
}

interface TestResult {
  success: boolean
  numPassedTests: number
  numFailedTests: number
  numTotalTests: number
  testResults: Array<{
    title: string
    status: 'passed' | 'failed'
    duration: number
  }>
  rawOutput: string
  error: string | null
  executionTime: number
  exitCode?: number
}

export default function SettingsPage() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [loading, setLoading] = useState(true)
  const [runningTest, setRunningTest] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({})
  const [activeTab, setActiveTab] = useState<'overview' | 'individual'>('overview')
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [esp32Bypass, setEsp32Bypass] = useState<boolean>(false)

  // Load ESP32 bypass setting from localStorage on mount
  useEffect(() => {
    const savedBypass = localStorage.getItem('esp32Bypass')
    if (savedBypass === 'true') {
      setEsp32Bypass(true)
    }
  }, [])

  // Save ESP32 bypass setting to localStorage when changed
  const handleEsp32BypassChange = (enabled: boolean) => {
    setEsp32Bypass(enabled)
    localStorage.setItem('esp32Bypass', enabled.toString())
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('esp32BypassChanged', { detail: enabled }))
  }

  useEffect(() => {
    fetchTestSuites()
  }, [])

  const fetchTestSuites = async () => {
    try {
      setLoading(true)
      const response = await getTestSuites()
      setTestSuites(response.suites || [])
    } catch (error) {
      console.error('Error fetching test suites:', error)
      setError('Failed to load test suites')
    } finally {
      setLoading(false)
    }
  }

  const handleRunAllTests = async () => {
    setRunningTest('all')
    setError(null)
    
    try {
      const result = await runAllTests()
      setTestResults(prev => ({ ...prev, all: result }))
    } catch (error) {
      console.error('Error running all tests:', error)
      setError('Failed to run tests')
    } finally {
      setRunningTest(null)
    }
  }

  const handleRunTestSuite = async (suiteId: string) => {
    setRunningTest(suiteId)
    setError(null)
    
    try {
      const result = await runTestSuite(suiteId)
      setTestResults(prev => ({ ...prev, [suiteId]: result }))
    } catch (error) {
      console.error('Error running test suite:', error)
      setError('Failed to run test suite')
    } finally {
      setRunningTest(null)
    }
  }

  const handleRunSpecificTest = async (testName: string, suiteId: string) => {
    const testKey = `${suiteId}:${testName}`
    setRunningTest(testKey)
    setError(null)
    
    try {
      const result = await runSpecificTest(testName, suiteId)
      setTestResults(prev => ({ ...prev, [testKey]: result }))
    } catch (error) {
      console.error('Error running specific test:', error)
      setError('Failed to run test')
    } finally {
      setRunningTest(null)
    }
  }

  const getTestStatus = (testKey: string) => {
    const result = testResults[testKey]
    if (!result) return 'idle'
    if (runningTest === testKey) return 'running'
    return result.success ? 'passed' : 'failed'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <TestTube className="h-4 w-4 text-gray-400" />
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading test suites...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Settings & Testing</h1>
              <p className="text-gray-600">Manage system settings and run integration tests</p>
            </div>
            <Link href="/" className="btn btn-secondary btn-md">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ESP32 Bypass Section */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                ESP32 Controller Settings
              </h2>
              <p className="text-gray-600">Temporary bypass controls for development and testing</p>
            </div>
          </div>

          {/* ESP32 Bypass Toggle */}
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bug className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">ESP32 Online Check Bypass</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Skip ESP32 connectivity checks and allow wash controls even when ESP32 is offline. 
                    <span className="font-medium"> For development/testing only.</span>
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={esp32Bypass}
                  onChange={(e) => handleEsp32BypassChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              </label>
            </div>
            
            {esp32Bypass && (
              <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">
                    BYPASS ACTIVE: Wash controls will work regardless of ESP32 status
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Management Section */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <TestTube className="h-5 w-5 mr-2" />
                Integration Test Management
              </h2>
              <p className="text-gray-600">Run and monitor integration tests for the application</p>
            </div>
            <button
              onClick={handleRunAllTests}
              disabled={runningTest !== null}
              className="btn btn-primary btn-md"
            >
              {runningTest === 'all' ? (
                <Clock className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run All Tests
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Test Suites Overview
              </button>
              <button
                onClick={() => setActiveTab('individual')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'individual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Individual Tests
              </button>
            </nav>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {testSuites.map((suite) => {
                const suiteResult = testResults[suite.id]
                const status = getTestStatus(suite.id)
                
                return (
                  <div key={suite.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {getStatusIcon(status)}
                          <h3 className="text-lg font-medium text-gray-900 ml-2">{suite.name}</h3>
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                            {suite.testCount} tests
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">{suite.description}</p>
                        
                        {suiteResult && (
                          <div className="mt-2 flex items-center space-x-4 text-sm">
                            <span className="text-green-600">
                              ✓ {suiteResult.numPassedTests} passed
                            </span>
                            {suiteResult.numFailedTests > 0 && (
                              <span className="text-red-600">
                                ✗ {suiteResult.numFailedTests} failed
                              </span>
                            )}
                            <span className="text-gray-500">
                              {formatDuration(suiteResult.executionTime)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleRunTestSuite(suite.id)}
                          disabled={runningTest !== null}
                          className="btn btn-secondary btn-sm"
                        >
                          {runningTest === suite.id ? (
                            <Clock className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        
                        <button
                          onClick={() => setSelectedSuite(selectedSuite === suite.id ? null : suite.id)}
                          className="btn btn-ghost btn-sm"
                        >
                          {selectedSuite === suite.id ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>

                    {/* Test Results Details */}
                    {suiteResult && selectedSuite === suite.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-2">Test Results</h4>
                        <div className="space-y-1 mb-4">
                          {suiteResult.testResults.map((test, index) => (
                            <div key={index} className="flex items-center text-sm">
                              {test.status === 'passed' ? (
                                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500 mr-2" />
                              )}
                              <span className={test.status === 'passed' ? 'text-gray-700' : 'text-red-700'}>
                                {test.title}
                              </span>
                              {test.duration > 0 && (
                                <span className="ml-auto text-gray-500">
                                  {formatDuration(test.duration)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {suiteResult.error && (
                          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                            <h5 className="font-medium text-red-800 mb-1">Error Output</h5>
                            <pre className="text-xs text-red-700 whitespace-pre-wrap">{suiteResult.error}</pre>
                          </div>
                        )}
                        
                        <details className="bg-gray-50 border border-gray-200 rounded p-3">
                          <summary className="cursor-pointer font-medium text-gray-700">Raw Output</summary>
                          <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {suiteResult.rawOutput}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Individual Tests Tab */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              {testSuites.map((suite) => (
                <div key={suite.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">{suite.name}</h3>
                  <div className="grid gap-2">
                    {suite.id === 'customer-creation' && [
                      'should create a customer with all required fields',
                      'should create a customer with minimal required fields only',
                      'should create a customer with all optional fields',
                      'should create multiple customers with different email addresses',
                      'should persist customer data to database correctly',
                      'should return 400 when name is missing',
                      'should return 400 when name is empty string',
                      'should return 400 when name is only whitespace',
                      'should return 400 when email is missing',
                      'should return 400 when email format is invalid',
                      'should return 400 when membershipStatus is invalid',
                      'should return 400 when phone number format is invalid',
                      'should return 400 with multiple validation errors',
                      'should return 500 when trying to create customer with duplicate email',
                      'should return 500 when trying to create customer with duplicate RFID tag',
                      'should handle very long names correctly',
                      'should trim whitespace from name field',
                      'should handle special characters in name',
                      'should create customer without phone number',
                      'should create customer without RFID tag',
                      'should handle all valid membership statuses'
                    ].map((testName) => {
                      const testKey = `${suite.id}:${testName}`
                      const testResult = testResults[testKey]
                      const status = getTestStatus(testKey)
                      
                      return (
                        <div key={testName} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                          <div className="flex items-center flex-1">
                            {getStatusIcon(status)}
                            <span className="ml-2 text-sm text-gray-700">{testName}</span>
                            {testResult && (
                              <span className="ml-2 text-xs text-gray-500">
                                {formatDuration(testResult.executionTime)}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRunSpecificTest(testName, suite.id)}
                            disabled={runningTest !== null}
                            className="btn btn-secondary btn-sm ml-4"
                          >
                            {runningTest === testKey ? (
                              <Clock className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overall Test Summary */}
        {Object.keys(testResults).length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Bug className="h-5 w-5 mr-2" />
              Test Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">Passed Tests</p>
                    <p className="text-2xl font-bold text-green-900">
                      {Object.values(testResults).reduce((acc, result) => acc + result.numPassedTests, 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">Failed Tests</p>
                    <p className="text-2xl font-bold text-red-900">
                      {Object.values(testResults).reduce((acc, result) => acc + result.numFailedTests, 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <TestTube className="h-8 w-8 text-blue-500" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800">Total Tests</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {Object.values(testResults).reduce((acc, result) => acc + result.numTotalTests, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
} 