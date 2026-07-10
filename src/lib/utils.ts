export function fmtINR(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN')
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateShort(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(checkin)
  const b = new Date(checkout)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
}

export function calcSubtotal(
  planType: string,
  guests: number,
  rooms: number,
  ratePerUnit: number,
  nights: number
): number {
  if (['AP', 'MAP', 'CP'].includes(planType)) {
    return guests * ratePerUnit * nights
  }
  return rooms * ratePerUnit * nights
}

export function getPlanLabel(plan: string): string {
  const labels: Record<string, string> = {
    AP: 'AP — All Meals',
    MAP: 'MAP — Breakfast + 1 Meal',
    CP: 'CP — Breakfast Only',
    EP: 'EP — Room Only',
    LODGING: 'Lodging Only',
  }
  return labels[plan] ?? plan
}

export function getStatusLabel(status: string): string {
  return status === 'PAID' ? '✓ Fully Paid' : status === 'PARTIAL' ? '½ Partial' : '✗ Pending'
}

export function genBookingRef(count: number): string {
  return 'BK' + String(count).padStart(4, '0')
}

export function totalPaid(advance: number, payments: { amount: number }[]): number {
  return advance + payments.reduce((sum, p) => sum + p.amount, 0)
}

export function computeStatus(totalCost: number, paid: number): 'PAID' | 'PARTIAL' | 'PENDING' {
  if (paid >= totalCost) return 'PAID'
  if (paid > 0) return 'PARTIAL'
  return 'PENDING'
}

export const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank' },
] as const

export function getPaymentModeLabel(mode?: string | null): string {
  if (!mode) return '—'
  return PAYMENT_MODES.find(m => m.value === mode)?.label ?? mode
}

export const EXPENSE_CATEGORIES = [
  'Groceries & Kitchen',
  'Staff Salary',
  'Electricity',
  'Water',
  'Fuel / Gas',
  'Repairs & Maintenance',
  'Housekeeping & Laundry',
  'Transport',
  'Marketing & Commission',
  'Rent',
  'Refund',
  'Miscellaneous',
]
