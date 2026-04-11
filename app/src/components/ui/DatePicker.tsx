'use client'
import { useState } from 'react'

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  min?: string
  max?: string
  label?: string
}

export default function DatePicker({ value, onChange, min, max, label }: DatePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange?.(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}
