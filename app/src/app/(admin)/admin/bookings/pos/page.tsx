"use client";

import { useEffect, useState } from "react";

import { BookingStatusBadge } from "@/components/booking/BookingStatusBadge";
import { DataTable, type DataTableColumn } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pagination } from "@/components/layout/Pagination";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BookingItem {
  id: string;
  bookingNumber: string;
  bookedBy?: {
    id: string;
    name: string;
    role: string;
    subRole: string | null;
  } | null;
  guestName: string;
  guestMobile: string;
  visitDate: string;
  adults: number;
  children: number;
  totalAmount: number;
  status: string;
}

interface BookingListResponse {
  items: BookingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminPosBookingsPage(): JSX.Element {
  const [items, setItems] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState<BookingListResponse["pagination"]>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  async function loadBookings(): Promise<void> {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(perPage),
        source: "POS",
      });
      if (search.trim()) query.set("search", search.trim());
      if (status) query.set("status", status);

      const response = await fetch(`/api/v1/bookings?${query.toString()}`);
      const payload = (await response.json().catch(() => null)) as BookingListResponse | null;
      if (!response.ok || !payload) {
        setItems([]);
        return;
      }
      setItems(payload.items);
      setPagination(payload.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, status]);

  const columns: Array<DataTableColumn<BookingItem>> = [
    {
      key: "bookingNumber",
      header: "Booking",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.bookingNumber}</p>
          <p className="text-xs">{formatDate(row.visitDate)}</p>
        </div>
      ),
    },
    {
      key: "bookedBy",
      header: "POS Staff",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.bookedBy?.name ?? "System"}</p>
          <p className="text-xs">{row.bookedBy?.subRole?.replaceAll("_", " ") ?? row.bookedBy?.role ?? "N/A"}</p>
        </div>
      ),
    },
    {
      key: "guest",
      header: "Guest",
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.guestName}</p>
          <p className="text-xs">{row.guestMobile}</p>
        </div>
      ),
    },
    {
      key: "pax",
      header: "Pax",
      render: (row) => `${row.adults + row.children} (${row.adults}A/${row.children}C)`,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <BookingStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <a href={`/admin/bookings/${row.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="POS Bookings"
        subtitle="Bookings created from POS walk-in flow."
      />

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-[1fr_220px_auto]">
        <Input
          placeholder="Search by booking number, guest, mobile"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { label: "All Status", value: "" },
            { label: "PENDING", value: "PENDING" },
            { label: "CONFIRMED", value: "CONFIRMED" },
            { label: "CHECKED_IN", value: "CHECKED_IN" },
            { label: "COMPLETED", value: "COMPLETED" },
            { label: "CANCELLED", value: "CANCELLED" },
          ]}
        />
        <Button
          variant="outline"
          onClick={() => {
            setPage(1);
            void loadBookings();
          }}
        >
          Apply Filters
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        loading={loading}
        rowKey={(row) => row.id}
        emptyTitle="No POS bookings found"
        emptyMessage="Try changing status or search query."
      />

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        perPage={pagination.limit}
        onPageChange={setPage}
        onPerPageChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />
    </div>
  );
}

