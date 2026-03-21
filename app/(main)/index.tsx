import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSubscriptions } from '@/src/hooks/useSubscriptions';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { useUiPrefsStore } from '@/src/stores/uiPrefsStore';
import { SummaryBar } from '@/src/components/subscription/SummaryBar';
import { SubscriptionListItem } from '@/src/components/subscription/SubscriptionListItem';
import { CategoryBreakdown } from '@/src/components/subscription/CategoryBreakdown';
import { toMonthlyAmount } from '@/src/utils/amountUtils';
import { STALE_CANCEL_DAYS } from '@/src/constants/app';
import type { SortKey } from '@/src/constants/app';
import type { Subscription, SubscriptionStatus } from '@/src/types';

type FilterStatus = 'all' | SubscriptionStatus;

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: '全て',
  active: '利用中',
  reviewing: '見直す',
  cancel_planned: '解約する',
  stopped: '解約済み',
};
const FILTERS: FilterStatus[] = ['all', 'active', 'reviewing', 'cancel_planned', 'stopped'];
const SORT_LABELS: Record<SortKey, string> = {
  createdAt: '登録順',
  nextRenewalDate: '更新日順',
  amount: '金額順',
};
const SORTS: SortKey[] = ['createdAt', 'nextRenewalDate', 'amount'];

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>まだ登録がありません</Text>
      <Text style={styles.emptyDesc}>{'使っているサブスクを登録して、\n支出を整理しましょう'}</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/subscription/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>手動で登録する</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.emptyGmailButton}
        onPress={() => router.push('/(main)/gmail-scan')}
        activeOpacity={0.8}
      >
        <Ionicons name="mail-outline" size={16} color={COLORS.primary} />
        <Text style={styles.emptyGmailButtonText}>Gmailから自動で探す</Text>
      </TouchableOpacity>
    </View>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="filter-outline" size={40} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>該当なし</Text>
      <Text style={styles.emptyDesc}>この条件には登録がありません</Text>
      <TouchableOpacity style={styles.clearButton} onPress={onClear} activeOpacity={0.7}>
        <Text style={styles.clearButtonText}>すべて表示に戻す</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const { subscriptions, summary } = useSubscriptions();
  const batchRolloverRenewalDates = useSubscriptionStore((s) => s.batchRolloverRenewalDates);
  const { sortKey, setSortKey } = useUiPrefsStore();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const handleItemPress = (item: Subscription) => {
    router.push(`/subscription/${item.id}`);
  };

  const cycleSortKey = () => {
    const idx = SORTS.indexOf(sortKey);
    setSortKey(SORTS[(idx + 1) % SORTS.length]);
  };

  // 課金中と見なすステータス（active / reviewing / cancel_planned）のサブスクかを判定
  const isPayingStatus = (s: Subscription) =>
    s.status === 'active' || s.status === 'reviewing' || s.status === 'cancel_planned';

  const hasNonMonthly = useMemo(
    () => subscriptions.some(
      (s) => isPayingStatus(s) && (s.billingCycle === 'yearly' || s.billingCycle === 'quarterly'),
    ),
    [subscriptions],
  );

  // 不定期課金は月額換算できないため集計対象外。その旨を SummaryBar で表示するためのフラグ。
  const hasIrregular = useMemo(
    () => subscriptions.some(
      (s) => isPayingStatus(s) && s.billingCycle === 'irregular',
    ),
    [subscriptions],
  );

  const displayedSubscriptions = useMemo(() => {
    let list = filterStatus === 'all'
      ? subscriptions
      : subscriptions.filter((s) => s.status === filterStatus);

    list = [...list].sort((a, b) => {
      if (sortKey === 'nextRenewalDate') {
        const da = a.nextRenewalDate ?? '9999-12-31';
        const db = b.nextRenewalDate ?? '9999-12-31';
        return da < db ? -1 : da > db ? 1 : 0;
      }
      if (sortKey === 'amount') {
        const ma = toMonthlyAmount(a.amount, a.billingCycle) ?? 0;
        const mb = toMonthlyAmount(b.amount, b.billingCycle) ?? 0;
        return mb - ma;
      }
      // createdAt: 新しい順
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    return list;
  }, [subscriptions, filterStatus, sortKey]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>サブスク整理</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(main)/settings')}
            activeOpacity={0.7}
            accessibilityLabel="設定"
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(main)/archived')}
            activeOpacity={0.7}
            accessibilityLabel="非表示にした項目"
          >
            <Ionicons name="eye-off-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton} onPress={cycleSortKey} activeOpacity={0.7}>
            <Ionicons name="swap-vertical-outline" size={16} color={COLORS.primary} />
            <Text style={styles.sortLabel}>{SORT_LABELS[sortKey]}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SummaryBar
        summary={summary}
        hasNonMonthly={hasNonMonthly}
        hasIrregular={hasIrregular}
        onReviewingPress={() => setFilterStatus('reviewing')}
        onRenewalAlertPress={() => { setFilterStatus('active'); setSortKey('nextRenewalDate'); }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filterStatus === f && styles.chipActive]}
            onPress={() => setFilterStatus(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filterStatus === f && styles.chipTextActive]}>
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 解約する放置バナー: STALE_CANCEL_DAYS 日以上手続きが止まっている場合に表示 */}
      {summary.staleCancelCount > 0 && (
        <TouchableOpacity
          style={styles.staleBanner}
          onPress={() => setFilterStatus('cancel_planned')}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={15} color={COLORS.warning.text} />
          <Text style={styles.staleBannerText}>
            {`解約手続き中が${STALE_CANCEL_DAYS}日以上経過 (${summary.staleCancelCount}件) — 確認する`}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.warning.text} />
        </TouchableOpacity>
      )}

      {/* 更新日超過バナー: まとめて繰り越す */}
      {summary.overdueRenewalCount > 0 && (
        <TouchableOpacity
          style={styles.renewalOverdueBanner}
          onPress={batchRolloverRenewalDates}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={15} color={COLORS.primary} />
          <Text style={styles.renewalOverdueBannerText}>
            {`更新日が過ぎています (${summary.overdueRenewalCount}件) — まとめて次回に繰り越す`}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={displayedSubscriptions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionListItem subscription={item} onPress={() => handleItemPress(item)} />
        )}
        ListHeaderComponent={
          filterStatus === 'all' ? (
            <CategoryBreakdown subscriptions={subscriptions} />
          ) : null
        }
        ListEmptyComponent={
          filterStatus !== 'all'
            ? <FilteredEmptyState onClear={() => setFilterStatus('all')} />
            : <EmptyState />
        }
        contentContainerStyle={displayedSubscriptions.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/subscription/new')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: COLORS.primaryLight,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.warning.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warning.border,
  },
  staleBannerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning.text,
    fontWeight: '500',
  },
  renewalOverdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  renewalOverdueBannerText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  emptyContainer: { flex: 1, paddingBottom: 100 },
  listContent: { paddingBottom: 100 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignSelf: 'center',
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 0,
  },
  emptyGmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'center',
  },
  emptyGmailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  clearButton: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
