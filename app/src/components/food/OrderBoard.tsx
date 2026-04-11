"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency } from "@/lib/utils";

interface OrderItem { name: string; quantity: number }

interface FoodOrder {
  id: string;
  token: string | null;
  guestName: string;
  totalAmount: number;
  status: "PENDING" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  orderItems: OrderItem[];
}

const STATUS_COLS: Array<FoodOrder["status"]> = ["PENDING", "PREPARING", "READY", "DELIVERED"];

const STATUS_COLORS: Record<FoodOrder["status"], string> = {
  PENDING: "default",
  PREPARING: "warning",
  READY: "success",
  DELIVERED: "default",
  CANCELLED: "error",
};

const NEXT_STATUS: Partial<Record<FoodOrder["status"], FoodOrder["status"]>> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

const NEXT_LABEL: Partial<Record<FoodOrder["status"], string>> = {
  PENDING: "Start",
  PREPARING: "Mark Ready",
  READY: "Delivered",
};

interface Props { outletId: string; date: string }

export function OrderBoard({ outletId, date }: Props) {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ outletId, date, limit: "200" });
      const res = await fetch(`/api/v1/food/orders?${q.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { orders: FoodOrder[] };
        setOrders(data.orders);
      }
    } finally {
      setLoading(false);
    }
  }, [outletId, date]);

  async function advance(orderId: string, nextStatus: FoodOrder["status"]) {
    await fetch(`/api/v1/food/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    await load();
  }

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {STATUS_COLS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col);
          return (
            <div key={col} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[var(--color-text)] uppercase tracking-wide">{col}</h3>
                <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-xs font-medium">
                  {colOrders.length}
                </span>
              </div>
              {colOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-lg text-[var(--color-primary)]">
                      #{order.token ?? "—"}
                    </span>
                    <Badge variant={STATUS_COLORS[order.status] as never}>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{order.guestName}</p>
                  <ul className="text-xs text-[var(--color-muted)] space-y-0.5">
                    {order.orderItems.map((item, i) => (
                      <li key={i}>{item.quantity}× {item.name}</li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold text-[var(--color-text)]">
                    {formatCurrency(order.totalAmount)}
                  </p>
                  {NEXT_STATUS[order.status] && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => void advance(order.id, NEXT_STATUS[order.status]!)}
                    >
                      {NEXT_LABEL[order.status]}
                    </Button>
                  )}
                </div>
              ))}
              {colOrders.length === 0 && (
                <p className="text-xs text-[var(--color-muted)] text-center py-4">Empty</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
