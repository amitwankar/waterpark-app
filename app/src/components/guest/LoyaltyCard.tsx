'use client'
export default function LoyaltyCard({ points }: { points: number }) {
  return (
    <div className="bg-gradient-to-r from-primary to-teal-700 text-white rounded-2xl p-6">
      <p className="text-sm opacity-80">Loyalty Points</p>
      <p className="text-4xl font-bold mt-1">{points?.toLocaleString('en-IN')}</p>
      <p className="text-xs opacity-70 mt-2">Earn 1 point per Rs.1 spent</p>
    </div>
  )
}
