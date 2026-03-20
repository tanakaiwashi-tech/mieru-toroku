import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SubscriptionSummary } from '@/src/types';
import { COLORS } from '@/src/constants/colors';
import { USD_TO_JPY_RATE } from '@/src/constants/app';
import { formatAmount, toYearlyAmount } from '@/src/utils/amountUtils';

interface StatCellProps {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
  dimmed?: boolean;
  /** 指定時はタップ可能なセルになり、ラベルに「→」を付与する */
  onPress?: () => void;
}

function StatCell({ label, value, bold = false, accent = false, dimmed = false, onPress }: StatCellProps) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.cell, dimmed && styles.cellDimmed]} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.value, bold && styles.valueBold, accent && styles.valueAccent]}>
          {value}
        </Text>
        <Text style={[styles.cellLabel, styles.cellLabelTappable]}>{label} →</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.cell, dimmed && styles.cellDimmed]}>
      <Text style={[styles.value, bold && styles.valueBold, accent && styles.valueAccent]}>
        {value}
      </Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

interface SummaryBarProps {
  summary: SubscriptionSummary;
  /** 年払い・3ヶ月払いのサブスクが存在するか（注意書き表示用） */
  hasNonMonthly?: boolean;
  /** 不定期課金のサブスクが存在するか（集計対象外の注意書き表示用） */
  hasIrregular?: boolean;
  /** 「見直す」セルをタップしたときのコールバック */
  onReviewingPress?: () => void;
  /** 「更新が近い / 要確認」セルをタップしたときのコールバック */
  onRenewalAlertPress?: () => void;
}

export function SummaryBar({
  summary,
  hasNonMonthly = false,
  hasIrregular = false,
  onReviewingPress,
  onRenewalAlertPress,
}: SummaryBarProps) {
  const { totalMonthlyAmount, hasUSD, reviewingCount, upcomingRenewalCount, overdueRenewalCount } = summary;
  // 更新日セルは「超過」優先表示。超過がない場合のみ「更新が近い」を表示。
  // 合算することで件数とラベルの意味がずれるのを防ぐ。
  const renewalAlertCount = overdueRenewalCount > 0 ? overdueRenewalCount : upcomingRenewalCount;
  const renewalAlertLabel = overdueRenewalCount > 0 ? '更新日を確認' : '更新が近い';

  // 月額 ↔ 年額トグル
  const [showYearly, setShowYearly] = useState(false);
  const displayAmount = showYearly
    ? toYearlyAmount(totalMonthlyAmount)
    : totalMonthlyAmount;
  const displayLabel = showYearly ? '年額合計（概算）' : '月額合計（概算）';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.totalRow}
        onPress={() => setShowYearly((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.totalLabelRow}>
          <Text style={styles.totalLabel}>{displayLabel}</Text>
          <Text style={styles.toggleHint}>
            {showYearly ? '← 月額に切り替え' : '年額でも見る →'}
          </Text>
        </View>
        <Text style={styles.totalAmount}>{formatAmount(displayAmount)}</Text>
      </TouchableOpacity>

      {/* 注意書き: 該当するものを1行にまとめて表示 */}
      {(hasNonMonthly || hasUSD || hasIrregular) && (
        <Text style={styles.hint}>
          {'※ ' + [
            hasNonMonthly && '年払い換算含む',
            hasUSD && `USD=¥${USD_TO_JPY_RATE}換算`,
            hasIrregular && '不定期除く',
          ].filter(Boolean).join(' · ')}
        </Text>
      )}

      {(reviewingCount > 0 || renewalAlertCount > 0) && (
        <View style={styles.statsRow}>
          <StatCell
            label="見直す"
            value={`${reviewingCount}件`}
            bold={reviewingCount > 0}
            accent={reviewingCount > 0}
            dimmed={reviewingCount === 0}
            onPress={reviewingCount > 0 ? onReviewingPress : undefined}
          />
          <View style={styles.divider} />
          <StatCell
            label={renewalAlertLabel}
            value={`${renewalAlertCount}件`}
            bold={renewalAlertCount > 0}
            accent={overdueRenewalCount > 0}
            onPress={renewalAlertCount > 0 ? onRenewalAlertPress : undefined}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabelRow: {
    gap: 2,
    flex: 1,
    marginRight: 12,
  },
  totalLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  toggleHint: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  hint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: -2,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  cellDimmed: {
    opacity: 0.35,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  value: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  valueBold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  valueAccent: {
    color: COLORS.destructive,
  },
  cellLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  cellLabelTappable: {
    color: COLORS.primary,
  },
});
