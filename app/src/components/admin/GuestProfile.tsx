'use client'
export default function GuestProfile({ guest }: { guest: any }) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-lg font-semibold">{guest?.name}</h2>
      <p className="text-sm text-gray-500">{guest?.mobile}</p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div><div className="text-xs text-gray-400">Visits</div><div className="font-semibold">{guest?.totalVisits}</div></div>
        <div><div className="text-xs text-gray-400">Spend</div><div className="font-semibold">Rs.{guest?.totalSpend}</div></div>
        <div><div className="text-xs text-gray-400">Points</div><div className="font-semibold">{guest?.loyaltyPoints}</div></div>
      </div>
    </div>
  )
}
