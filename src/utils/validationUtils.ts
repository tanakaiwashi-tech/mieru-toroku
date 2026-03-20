/**
 * 入力値の安全性チェック用ユーティリティ。
 * URL インジェクション・無効な日付・異常金額を防ぐ。
 */

import type { BillingCycle, Currency } from '@/src/types';

// ─── URL ────────────────────────────────────────────────

/**
 * http: または https: スキームのみを許可する。
 * javascript:, data:, vbscript: などのインジェクションを防ぐ。
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── 日付 ────────────────────────────────────────────────

/**
 * YYYY-MM-DD 形式かつ実在する日付かを検証する。
 * 例: "2024-13-01" や "2024-02-30" は false を返す。
 */
export function isValidDateString(dateStr: string): boolean {
  // 形式チェック: 月は 01-12、日は 01-31
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dateStr)) {
    return false;
  }
  // 実在する日付かチェック（例: 2/30 など）
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
}

// ─── 金額 ────────────────────────────────────────────────

/** 金額として有効な整数かを検証する（1以上・上限1千万円）。¥0は free サイクルを使うべき。 */
export const AMOUNT_MAX = 9_999_999;

export function isValidAmount(value: string): boolean {
  if (!value) return false;
  // 整数のみ（小数・指数表記を拒否）
  if (!/^\d+$/.test(value)) return false;
  const n = Number(value);
  return n >= 1 && n <= AMOUNT_MAX;
}

// ─── フォームバリデーション ────────────────────────────────

export interface SubscriptionFormErrors {
  serviceName?: string;
  amount?: string;
  nextRenewalDate?: string;
  trialEndDate?: string;
  startDate?: string;
  customCancelUrl?: string;
}

/**
 * サブスクフォームのバリデーション（new.tsx / [id].tsx 共通）。
 * エラーがなければ空オブジェクトを返す。
 */
export function validateSubscriptionForm(fields: {
  serviceName: string;
  billingCycle: BillingCycle;
  amount: string;
  currency: Currency;
  nextRenewalDate: string;
  trialEndDate: string;
  startDate: string;
  customCancelUrl: string;
}): SubscriptionFormErrors {
  const errors: SubscriptionFormErrors = {};

  if (!fields.serviceName.trim()) {
    errors.serviceName = 'サービス名を入力してください';
  }
  if (fields.billingCycle !== 'free' && !isValidAmount(fields.amount)) {
    errors.amount = fields.currency === 'USD'
      ? '1以上の整数（ドル）を入力してください'
      : `1〜${AMOUNT_MAX.toLocaleString()}の整数を入力してください`;
  }
  if (fields.nextRenewalDate && !isValidDateString(fields.nextRenewalDate)) {
    errors.nextRenewalDate = '実在する日付を入力してください';
  }
  if (fields.trialEndDate && !isValidDateString(fields.trialEndDate)) {
    errors.trialEndDate = '実在する日付を入力してください';
  }
  if (fields.startDate && !isValidDateString(fields.startDate)) {
    errors.startDate = '実在する日付を入力してください';
  }
  if (fields.customCancelUrl.trim() && !isSafeUrl(fields.customCancelUrl.trim())) {
    errors.customCancelUrl = 'https:// か http:// で始まるURLを入力してください';
  }

  return errors;
}
