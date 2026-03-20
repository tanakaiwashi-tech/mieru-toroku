import type { BillingCycle, SubscriptionStatus } from '@/src/types';

export const FREE_LIMIT_COUNT = 15;
export const UPCOMING_RENEWAL_DAYS = 30;
/** USD → JPY 換算レート（概算固定値）。集計・表示用のみ使用。 */
export const USD_TO_JPY_RATE = 150;

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: '月払い',
  yearly: '年払い',
  quarterly: '3ヶ月払い',
  irregular: '不定期',
  free: '無料',
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '利用中',
  reviewing: '見直す',
  cancel_planned: '解約する',
  stopped: '解約済み',
};

/**
 * 月額換算係数（月払い基準）。
 * irregular / free は月額換算できないため null。
 */
export const BILLING_CYCLE_MONTHLY_FACTOR: Record<BillingCycle, number | null> = {
  monthly: 1,
  yearly: 1 / 12,
  quarterly: 1 / 3,
  irregular: null,
  free: null,
};

/** フォームで使う支払いサイクル選択肢（new.tsx / [id].tsx 共通） */
export const BILLING_CYCLE_OPTIONS: readonly BillingCycle[] = [
  'monthly', 'yearly', 'quarterly', 'irregular', 'free',
];

/** フォームで使うステータス選択肢（new.tsx / [id].tsx 共通） */
export const STATUS_OPTIONS: readonly SubscriptionStatus[] = [
  'active', 'reviewing', 'cancel_planned', 'stopped',
];
