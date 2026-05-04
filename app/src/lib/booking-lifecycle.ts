import { db } from "@/lib/db";

function startOfTodayUtc(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

export async function autoCheckoutExpiredCheckedInBookings(): Promise<number> {
  const todayUtc = startOfTodayUtc();
  const result = await (db as any).booking.updateMany({
    where: {
      status: "CHECKED_IN",
      visitDate: { lt: todayUtc },
    },
    data: {
      status: "COMPLETED",
    },
  });
  return Number(result?.count ?? 0);
}

