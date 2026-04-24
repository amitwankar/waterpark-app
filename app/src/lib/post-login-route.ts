import type { EmployeeSubRole, UserRole } from "@/types/auth";

export function getPostLoginRoute(
  role: UserRole | string,
  subRole?: EmployeeSubRole | string | null,
): string {
  if (role === "ADMIN") return "/admin/dashboard";

  if (role !== "EMPLOYEE") return "/";

  switch (subRole) {
    case "TICKET_COUNTER":
    case "SALES_EXECUTIVE":
    case "EVENT_COORDINATOR":
      return "/staff/pos";
    case "FB_STAFF":
      return "/staff/food";
    case "RIDE_OPERATOR":
      return "/staff/rides";
    case "MAINTENANCE_TECH":
      return "/staff/maintenance";
    case "LOCKER_ATTENDANT":
      return "/staff/lockers";
    case "COSTUME_ATTENDANT":
      return "/staff/costumes";
    case "PARKING_ATTENDANT":
      return "/staff/parking";
    case "SECURITY_STAFF":
      return "/staff/scan";
    default:
      return "/staff/pos";
  }
}
