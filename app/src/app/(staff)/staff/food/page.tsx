"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

import { PageHeader } from "@/components/layout/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FoodOrderForm } from "@/components/food/FoodOrderForm";
import { OrderBoard } from "@/components/food/OrderBoard";
import { Utensils } from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  isOpen: boolean;
}

export default function StaffFoodPage(): JSX.Element {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [activeTab, setActiveTab] = useState<"new-order" | "board">("board");
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    void (async () => {
      setLoadingOutlets(true);
      try {
        const res = await fetch("/api/v1/food/outlets");
        if (res.ok) {
          const data = (await res.json()) as Outlet[];
          setOutlets(data);
          if (data.length > 0) setSelectedOutlet(data[0]);
        }
      } finally {
        setLoadingOutlets(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food & Beverage"
        subtitle={`Today — ${format(new Date(), "d MMM yyyy")}`}
      />

      {loadingOutlets ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : outlets.length === 0 ? (
        <EmptyState icon={Utensils} title="No outlets available" message="Contact admin to set up food outlets." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selectedOutlet?.id ?? ""}
              onChange={(e) => {
                const o = outlets.find((x) => x.id === e.target.value) ?? null;
                setSelectedOutlet(o);
              }}
              options={outlets.map((o) => ({
                label: `${o.name}${o.isOpen ? "" : " (Closed)"}`,
                value: o.id,
              }))}
            />
            <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
              {(["board", "new-order"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface)] text-[var(--color-text)]"
                  }`}
                >
                  {tab === "board" ? "Order Board" : "New Order"}
                </button>
              ))}
            </div>
          </div>

          {selectedOutlet && (
            <>
              {activeTab === "board" && (
                <OrderBoard outletId={selectedOutlet.id} date={today} />
              )}
              {activeTab === "new-order" && (
                <FoodOrderForm
                  outlet={selectedOutlet}
                  onOrderCreated={() => setActiveTab("board")}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
