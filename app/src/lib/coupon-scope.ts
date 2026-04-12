export interface CouponScopeMatrix {
  ticket: boolean;
  food: boolean;
  locker: boolean;
  costume: boolean;
  ride: boolean;
  package: boolean;
}

const SCOPE_PREFIX = "SCOPE_V1:";

export function defaultCouponScopeMatrix(): CouponScopeMatrix {
  return {
    ticket: true,
    food: true,
    locker: true,
    costume: true,
    ride: true,
    package: true,
  };
}

export function normalizeCouponScopeMatrix(input?: Partial<CouponScopeMatrix> | null): CouponScopeMatrix {
  const fallback = defaultCouponScopeMatrix();
  if (!input) return fallback;
  return {
    ticket: Boolean(input.ticket),
    food: Boolean(input.food),
    locker: Boolean(input.locker),
    costume: Boolean(input.costume),
    ride: Boolean(input.ride),
    package: Boolean(input.package),
  };
}

export function encodeCouponScopeMatrix(input?: Partial<CouponScopeMatrix> | null): string {
  const normalized = normalizeCouponScopeMatrix(input);
  const raw = JSON.stringify(normalized);
  return `${SCOPE_PREFIX}${Buffer.from(raw, "utf8").toString("base64")}`;
}

export function decodeCouponScopeMatrix(value: string | null | undefined): CouponScopeMatrix | null {
  if (!value || !value.startsWith(SCOPE_PREFIX)) return null;
  try {
    const encoded = value.slice(SCOPE_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Partial<CouponScopeMatrix>;
    return normalizeCouponScopeMatrix(parsed);
  } catch {
    return null;
  }
}

export function resolveCouponScopeMatrix(value: string | null | undefined): CouponScopeMatrix {
  return decodeCouponScopeMatrix(value) ?? defaultCouponScopeMatrix();
}

export function isCouponScopeAllowed(
  scope: CouponScopeMatrix,
  usage?: Partial<CouponScopeMatrix> | null,
): boolean {
  if (!usage) return true;
  const normalizedUsage = normalizeCouponScopeMatrix(usage);
  if (normalizedUsage.ticket && !scope.ticket) return false;
  if (normalizedUsage.food && !scope.food) return false;
  if (normalizedUsage.locker && !scope.locker) return false;
  if (normalizedUsage.costume && !scope.costume) return false;
  if (normalizedUsage.ride && !scope.ride) return false;
  if (normalizedUsage.package && !scope.package) return false;
  return true;
}

