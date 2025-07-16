'use client'

import { triggerRelay } from "@/utils/api";
import { useState } from "react";

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

  const handleClick = async (id: number) => {
    setLoading(id);
    try {
      await triggerRelay(id);
      // Optional: Add success feedback
    } catch (error) {
      console.error('Failed to trigger relay:', error);
      // Optional: Add error feedback
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {washes.map((w) => (
        <button
          key={w.id}
          className={`p-4 text-white rounded-xl transition-all duration-200 ${
            loading === w.id 
              ? 'bg-green-600 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
          onClick={() => handleClick(w.id)}
          disabled={loading === w.id}
        >
          {loading === w.id ? 'Triggering...' : w.label}
        </button>
      ))}
    </div>
  );
} 