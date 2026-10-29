// 02 §3 reason codes
export type PartnerReason = 'international' | 'no_zip' | 'zip_not_in_zones' | 'no_stock' | 'invalid_order';
export type WarehouseReason = 'zone' | 'zone_tie_cover' | 'zone_tie_priority';

/** One evaluated warehouse, kept for traces and Part B what-ifs. */
export interface Candidate {
  readonly code: string;
  readonly zone: number;
  /** days of cover before reservation (D-10); Infinity when velocity is 0 (D-11) */
  readonly cover: number;
}

export interface PartnerDecision {
  readonly kind: 'partner';
  readonly orderNumber: string;
  readonly target: 'PARTNER';
  readonly reason: PartnerReason;
  readonly detail?: string;
}

export interface WarehouseDecision {
  readonly kind: 'warehouse';
  readonly orderNumber: string;
  readonly target: string;
  readonly reason: WarehouseReason;
  readonly zone: number;
  /** eligible warehouses only, sorted best first */
  readonly candidates: readonly Candidate[];
}

export type RouteDecision = PartnerDecision | WarehouseDecision;

export const partner = (orderNumber: string, reason: PartnerReason, detail?: string): PartnerDecision => ({
  kind: 'partner',
  orderNumber,
  target: 'PARTNER',
  reason,
  ...(detail === undefined ? {} : { detail }),
});

const TIE_SUFFIX: Record<WarehouseReason, string> = {
  zone: '',
  zone_tie_cover: ' (tie: cover)',
  zone_tie_priority: ' (tie: priority)',
};

/** R-14, D-16: `#2033  WH-NJ  zone 3` / `#2037  PARTNER  international`. */
export function formatDecision(d: RouteDecision): string {
  const reason = d.kind === 'partner' ? d.reason : `zone ${d.zone}${TIE_SUFFIX[d.reason]}`;
  return `${d.orderNumber}  ${d.target}  ${reason}`;
}
