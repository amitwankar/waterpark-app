"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardList, Package, Plus, Wrench } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface MaintenanceSummary {
  assets: { total: number; dueSoon: number; overdue: number; underMaintenance: number };
  workOrders: {
    open: number;
    inProgress: number;
    critical: number;
    highPriority: number;
    completedToday: number;
  };
  recentOrders: {
    id: string;
    workOrderNumber: string;
    title: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    status: string;
    assetName: string;
    createdAt: string;
  }[];
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "danger",
  HIGH:     "warning",
  MEDIUM:   "info",
  LOW:      "success",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "warning",
  IN_PROGRESS: "info",
  COMPLETED:   "success",
  REOPENED:    "danger",
};

export default function MaintenanceDashboardPage() {
  const [summary, setSummary] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [assetRes, woRes] = await Promise.all([
          fetch("/api/v1/maintenance/assets?take=0"),
          fetch("/api/v1/maintenance/work-orders?take=5&status=OPEN,IN_PROGRESS"),
        ]);
        const assetData = assetRes.ok ? await assetRes.json() : {};
        const woData = woRes.ok ? await woRes.json() : {};

        setSummary({
          assets: {
            total: assetData.summary?.total ?? 0,
            dueSoon: assetData.summary?.dueSoon ?? 0,
            overdue: assetData.summary?.overdue ?? 0,
            underMaintenance: assetData.summary?.underMaintenance ?? 0,
          },
          workOrders: {
            open: woData.counts?.OPEN ?? 0,
            inProgress: woData.counts?.IN_PROGRESS ?? 0,
            critical: woData.counts?.CRITICAL ?? 0,
            highPriority: woData.counts?.HIGH ?? 0,
            completedToday: woData.counts?.completedToday ?? 0,
          },
          recentOrders: woData.items ?? [],
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        subtitle="Asset management and work order tracking"
        actions={[
          {
            key: "assets",
            element: (
              <Link href="/admin/maintenance/assets">
                <Button variant="ghost">
                  <Package className="h-4 w-4" />
                  Assets
                </Button>
              </Link>
            ),
          },
          {
            key: "new-work-order",
            element: (
              <Link href="/admin/maintenance/work-orders">
                <Button>
                  <Plus className="h-4 w-4" />
                  New Work Order
                </Button>
              </Link>
            ),
          },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Quick nav cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/admin/maintenance/assets">
              <div className="bg-white border-2 border-gray-200 hover:border-teal-400 hover:bg-teal-50 rounded-2xl p-5 flex items-center gap-4 transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Package className="w-6 h-6 text-teal-700" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-teal-700">Asset Registry</p>
                  <p className="text-sm text-gray-500">
                    {summary?.assets.total ?? 0} total assets ·{" "}
                    <span className={summary?.assets.overdue ? "text-red-600 font-medium" : "text-gray-500"}>
                      {summary?.assets.overdue ?? 0} overdue
                    </span>
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <Link href="/admin/maintenance/work-orders">
              <div className="bg-white border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 rounded-2xl p-5 flex items-center gap-4 transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-orange-700" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-orange-700">Work Orders</p>
                  <p className="text-sm text-gray-500">
                    {(summary?.workOrders.open ?? 0) + (summary?.workOrders.inProgress ?? 0)} open ·{" "}
                    <span className={summary?.workOrders.critical ? "text-red-600 font-medium" : "text-gray-500"}>
                      {summary?.workOrders.critical ?? 0} critical
                    </span>
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Package, label: "Assets Total", value: summary?.assets.total ?? 0, color: "text-gray-700 bg-gray-50" },
              { icon: AlertTriangle, label: "Service Overdue", value: summary?.assets.overdue ?? 0, color: "text-red-700 bg-red-50" },
              { icon: Wrench, label: "In Maintenance", value: summary?.assets.underMaintenance ?? 0, color: "text-orange-700 bg-orange-50" },
              { icon: ClipboardList, label: "Open Work Orders", value: (summary?.workOrders.open ?? 0) + (summary?.workOrders.inProgress ?? 0), color: "text-blue-700 bg-blue-50" },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-xl p-4 flex items-center gap-3 ${kpi.color}`}>
                <kpi.icon className="w-6 h-6 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs font-medium mt-0.5">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent work orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Work Orders</h3>
                <Link href="/admin/maintenance/work-orders">
                  <Button variant="ghost" size="sm">View all</Button>
                </Link>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {!summary?.recentOrders.length ? (
                <p className="text-sm text-gray-500 text-center py-6">No open work orders</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {summary.recentOrders.map((wo) => (
                    <Link key={wo.id} href={`/admin/maintenance/work-orders/${wo.id}`}>
                      <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-gray-400">{wo.workOrderNumber}</span>
                            <Badge variant={PRIORITY_COLORS[wo.priority] as never}>{wo.priority}</Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{wo.title}</p>
                          <p className="text-xs text-gray-500">{wo.assetName}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <Badge variant={STATUS_COLORS[wo.status] as never}>{wo.status.replace("_", " ")}</Badge>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(wo.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
