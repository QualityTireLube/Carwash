'use client'

import { triggerRelay, testConnection } from "@/utils/api";
import { useState, useEffect } from "react";

const washes = [
  { label: "Basic Wash", id: 1 },
  { label: "Premium Wash", id: 2 },
  { label: "Deluxe Wash", id: 3 },
  { label: "Ultimate Wash", id: 4 },
  { label: "Reset Wash", id: 5 },
  { label: "Blank", id: 6 },
];

export default function WashButtons() {
  const [loading, setLoading] = useState<number | null>(null);
  const [espOnline, setEspOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Check ESP32 status on component mount
    checkEspStatus();
  }, []);

  const checkEspStatus = async () => {
    try {
      const status = await testConnection();
      setEspOnline(status.success);
    } catch (error) {
      setEspOnline(false);
    }
  };

  const handleClick = async (id: number) => {
    if (!espOnline) {
      alert('ESP32 controller is offline. Cannot trigger wash cycles.');
      return;
    }

    setLoading(id);
    try {
      await triggerRelay(id);
      // Optional: Add success feedback
    } catch (error) {
      console.error('Failed to trigger relay:', error);
      alert('Failed to trigger relay. ESP32 may be offline.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {!espOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ ESP32 controller is offline. Wash controls are disabled.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {washes.map((w) => (
          <button
            key={w.id}
            className={`p-4 text-white rounded-xl transition-all duration-200 ${
              loading === w.id 
                ? 'bg-green-600 cursor-not-allowed' 
                : !espOnline
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
            onClick={() => handleClick(w.id)}
            disabled={loading === w.id || !espOnline}
          >
            {loading === w.id ? 'Triggering...' : w.label}
          </button>
        ))}
      </div>
    </div>
  );
} 