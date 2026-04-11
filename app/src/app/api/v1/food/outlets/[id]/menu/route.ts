import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

/** Public-ish menu endpoint: returns full menu for an outlet including all active items. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;

  const outlet = await db.foodOutlet.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      location: true,
      isOpen: true,
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          items: {
            where: { isDeleted: false, isAvailable: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              sku: true,
              price: true,
              preBookPrice: true,
              gstRate: true,
              prepTimeMin: true,
              allergens: true,
              isVeg: true,
              isFeatured: true,
              imageUrl: true,
              sortOrder: true,
              variants: {
                where: { isAvailable: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                select: {
                  id: true,
                  name: true,
                  price: true,
                  preBookPrice: true,
                  isDefault: true,
                  sortOrder: true,
                },
              },
              modifierGroups: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                select: {
                  id: true,
                  name: true,
                  minSelect: true,
                  maxSelect: true,
                  isRequired: true,
                  sortOrder: true,
                  options: {
                    where: { isActive: true },
                    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      isDefault: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!outlet) {
    return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
  }

  return NextResponse.json(outlet);
}
