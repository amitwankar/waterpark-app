import { redirect } from "next/navigation";

import { requireSubRole } from "@/lib/session";

export default async function StaffFoodPosPage(): Promise<never> {
  const { error } = await requireSubRole("FB_STAFF");
  if (error) {
    redirect("/login");
  }

  redirect("/staff/food");
}

