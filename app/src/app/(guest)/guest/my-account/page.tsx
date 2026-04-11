"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, LogOut, Star, Ticket, User } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { authClient } from "@/lib/auth-client";

interface GuestProfile {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalVisits: number;
  totalSpend: number;
  lastVisitDate: string | null;
}

const TIER_COLORS: Record<string, string> = {
  BRONZE:   "bg-orange-100 text-orange-700",
  SILVER:   "bg-gray-100 text-gray-700",
  GOLD:     "bg-yellow-100 text-yellow-700",
  PLATINUM: "bg-purple-100 text-purple-700",
};

export default function MyAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/crm/guests/me");
        if (res.ok) setProfile(await res.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const menuItems = [
    {
      href: "/guest/my-account/bookings",
      icon: Ticket,
      label: "My Bookings",
      description: "View and manage your booking history",
    },
    {
      href: "/booking",
      icon: Calendar,
      label: "Book Tickets",
      description: "Plan your next visit",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Profile card */}
        <Card>
          <CardBody>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : profile ? (
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{profile.name}</h2>
                  <p className="text-sm text-gray-500">{profile.mobile}</p>
                  {profile.email && <p className="text-sm text-gray-500 truncate">{profile.email}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TIER_COLORS[profile.loyaltyTier] ?? "bg-gray-100 text-gray-600"}`}>
                      {profile.loyaltyTier}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Star className="w-3 h-3" />{profile.loyaltyPoints} pts
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">My Account</p>
                  <p className="text-sm text-gray-500">Manage your bookings and profile</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Stats row */}
        {profile && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Visits", value: profile.totalVisits },
              { label: "Total Spend", value: `₹${Number(profile.totalSpend).toFixed(0)}` },
              { label: "Loyalty Points", value: profile.loyaltyPoints },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <Card>
          <CardBody className="p-0 divide-y divide-gray-100">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>

        {/* Sign out */}
        <Button
          variant="ghost"
          icon={LogOut}
          onClick={handleSignOut}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
