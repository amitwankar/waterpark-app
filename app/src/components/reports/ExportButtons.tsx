"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface Props {
  report: string;
  dateFrom: string;
  dateTo: string;
}

export function ExportButtons({ report, dateFrom, dateTo }: Props) {
  function buildUrl(format: "csv" | "excel" | "pdf") {
    const q = new URLSearchParams({ format, dateFrom, dateTo });
    return `/api/v1/export/${report}?${q.toString()}`;
  }

  return (
    <div className="flex items-center gap-2">
      <a href={buildUrl("csv")} download>
        <Button size="sm" variant="outline">
          <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
        </Button>
      </a>
      <a href={buildUrl("excel")} download>
        <Button size="sm" variant="outline">
          <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
        </Button>
      </a>
      <a href={buildUrl("pdf")} download>
        <Button size="sm" variant="outline">
          <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
      </a>
    </div>
  );
}
