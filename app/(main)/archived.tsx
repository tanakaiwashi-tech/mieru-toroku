import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { SubscriptionListItem } from '@/src/components/subscription/SubscriptionListItem';

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="eye-off-outline" size={48} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>非表示にした項目はありません</Text>
      <Text style={styles.emptyDesc}>{'詳細画面で「非表示にする」を押すと、\nここに保管されます'}</Text>
    </View>
  );
}

export default function ArchivedScreen() {
  // subscriptions を安定した参照で取得し、render 内で filter（selector 内で filter すると
  // 毎回新しい配列参照が返され Zustand が無限ループを起こすため）
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const archived = subscriptions.filter((sub) => sub.isArchived);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>非表示にした項目</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={archived}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionListItem
            subscription={item}
            onPress={() => router.push(`/subscription/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={archived.length === 0 ? styles.emptyContainer : undefined}
      />
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
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyContainer: { flex: 1 },
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
});
