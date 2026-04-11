'use client'
import { useState } from 'react'

export default function AttendanceMarker() {
  const [status, setStatus] = useState<'idle' | 'in' | 'out'>('idle')

  const handleCheckIn = () => setStatus('in')
  const handleCheckOut = () => setStatus('out')

  return (
    <div className="bg-white rounded-xl border p-6 text-center">
      <h2 className="text-lg font-semibold mb-4">Attendance</h2>
      {status === 'idle' && (
        <button onClick={handleCheckIn} className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium">
          Check In
        </button>
      )}
      {status === 'in' && (
        <div>
          <p className="text-green-600 font-medium mb-3">Checked In</p>
          <button onClick={handleCheckOut} className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium">
            Check Out
          </button>
        </div>
      )}
      {status === 'out' && <p className="text-gray-500">Attendance marked for today.</p>}
    </div>
  )
}
