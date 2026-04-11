"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { paymentMethodLabel } from "@/lib/payment-methods";

export interface PaymentMethodDatum {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentMethodChartProps {
  data: PaymentMethodDatum[];
}

export function PaymentMethodChart({ data }: PaymentMethodChartProps): JSX.Element {
  const rows = data.map((item) => ({
    ...item,
    label: paymentMethodLabel(item.method),
  }));

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold text-[var(--color-text)]">Payment Method Mix</h3>
      </CardHeader>
      <CardBody className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 12, right: 16, left: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis dataKey="label" type="category" tick={{ fill: "#71717a", fontSize: 12 }} width={90} />
            <Tooltip formatter={(value: number, name) => (name === "count" ? value : `Rs ${value}`)} />
            <Bar dataKey="count" fill="#0f766e" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
