'use client'

import { triggerRelay, testConnection } from "@/utils/api";
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

const washes = [
  { label: "$10 Wash", id: 1 },
  { label: "$9 Wash", id: 2 },
  { label: "$8 Wash", id: 3 },
  { label: "$7 Wash", id: 4 },
  { label: "Spare", id: 5 },
];

interface CooldownInfo {
  relayId: number
  remainingTime: number
}

export default function WashButtons() {
  const [loading, setLoading] = useState<number | null>(null);
  const [espOnline, setEspOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<CooldownInfo[]>([]);
  const [esp32Bypass, setEsp32Bypass] = useState<boolean>(false);

  // Load ESP32 bypass setting and listen for changes
  useEffect(() => {
    const loadBypassSetting = () => {
      const savedBypass = localStorage.getItem('esp32Bypass')
      setEsp32Bypass(savedBypass === 'true')
    }
    
    loadBypassSetting()
    
    const handleBypassChange = (event: CustomEvent) => {
      setEsp32Bypass(event.detail)
    }
    
    window.addEventListener('esp32BypassChanged', handleBypassChange as EventListener)
    
    return () => {
      window.removeEventListener('esp32BypassChanged', handleBypassChange as EventListener)
    }
  }, []);

  useEffect(() => {
    // Check ESP32 status on component mount
    checkEspStatus();
  }, []);

  // Update cooldown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => prev
        .map(cooldown => ({
          ...cooldown,
          remainingTime: Math.max(0, cooldown.remainingTime - 1000)
        }))
        .filter(cooldown => cooldown.remainingTime > 0)
      )
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const checkEspStatus = async () => {
    try {
      const status = await testConnection();
      setEspOnline(status.success);
    } catch (error) {
      setEspOnline(false);
    }
  };

  const getRelayCooldown = (relayId: number): number => {
    const cooldown = cooldowns.find(c => c.relayId === relayId)
    return cooldown ? cooldown.remainingTime : 0
  }

  const isRelayOnCooldown = (relayId: number): boolean => {
    return getRelayCooldown(relayId) > 0
  }

  const handleClick = async (id: number) => {
    if (!espOnline && !esp32Bypass) {
      setError('ESP32 controller is offline. Cannot trigger wash cycles.');
      return;
    }

    if (isRelayOnCooldown(id)) {
      const remainingSeconds = Math.ceil(getRelayCooldown(id) / 1000)
      setError(`Please wait ${remainingSeconds} seconds before triggering this wash again`);
      return;
    }

    setLoading(id);
    setError(null);
    
    try {
      // Regular relay trigger
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trigger/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // Add cooldown for this relay (2 seconds)
        setCooldowns(prev => [
          ...prev.filter(c => c.relayId !== id),
          { relayId: id, remainingTime: 2000 }
        ]);
      } else if (response.status === 429) {
        // Handle spam protection error
        setError(data.error || 'Command blocked - please wait before trying again');
        
        // Extract cooldown time from error message if available
        const cooldownMatch = data.error?.match(/wait (\d+) seconds/);
        if (cooldownMatch) {
          const cooldownSeconds = parseInt(cooldownMatch[1]);
          setCooldowns(prev => [
            ...prev.filter(c => c.relayId !== id),
            { relayId: id, remainingTime: cooldownSeconds * 1000 }
          ]);
        }
      } else {
        setError(`Failed to trigger relay: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to trigger relay:', error);
      setError('Failed to trigger relay. ESP32 may be offline.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {!espOnline && !esp32Bypass && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            ⚠️ ESP32 controller is offline. Wash controls are disabled.
          </p>
        </div>
      )}

      {esp32Bypass && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-800">
            🔧 ESP32 Bypass Mode: Commands will be sent but physical relays may not respond
          </p>
        </div>
      )}
      
      {error && (
        <div className={`border rounded-lg p-3 ${
          error.startsWith('✅') 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {washes.map((w) => {
          const cooldownTime = getRelayCooldown(w.id);
          const isOnCooldown = isRelayOnCooldown(w.id);
          const isLoading = loading === w.id;
          const isDisabled = isLoading || (!espOnline && !esp32Bypass) || isOnCooldown;
          
          return (
            <div key={w.id} className="flex flex-col space-y-2">
              <button
                className={`p-4 text-white rounded-xl transition-all duration-200 ${
                  isLoading 
                    ? 'bg-green-600 cursor-not-allowed' 
                    : isOnCooldown
                    ? 'bg-gray-400 cursor-not-allowed'
                    : (!espOnline && !esp32Bypass)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
                onClick={() => handleClick(w.id)}
                disabled={isDisabled}
              >
                <div className="flex items-center justify-center space-x-2">
                  {isOnCooldown && (
                    <Clock className="h-4 w-4" />
                  )}
                  <span>
                    {isLoading 
                      ? 'Triggering...' 
                      : isOnCooldown 
                      ? `Wait ${Math.ceil(cooldownTime / 1000)}s`
                      : w.label}
                  </span>
                </div>
              </button>
              
              {isOnCooldown && (
                <div className="text-xs text-gray-500 text-center">
                  Cooldown: {Math.ceil(cooldownTime / 1000)}s
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 