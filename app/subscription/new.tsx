import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BILLING_CYCLE_LABELS,
  FREE_LIMIT_COUNT,
  BILLING_CYCLE_OPTIONS,
} from '@/src/constants/app';
import {
  CATEGORY_OPTIONS,
  type CategoryOption,
  type BillingCycle,
  type SubscriptionFormData,
  type ServiceDictionaryEntry,
  type Currency,
} from '@/src/types';
import { useSubscription } from '@/src/hooks/useSubscription';
import { SelectField } from '@/src/components/ui/SelectField';
import { TextInput } from '@/src/components/ui/TextInput';
import { DatePickerField } from '@/src/components/ui/DatePickerField';
import { Button } from '@/src/components/ui/Button';
import { AmountField } from '@/src/components/ui/AmountField';
import { ServiceNameAutocomplete } from '@/src/components/subscription/ServiceNameAutocomplete';
import { COLORS } from '@/src/constants/colors';
import { validateSubscriptionForm } from '@/src/utils/validationUtils';
import type { PricingPlan } from '@/src/types';

export default function NewSubscriptionScreen() {
  const { save } = useSubscription();
  const [isSaving, setIsSaving] = useState(false);

  const [serviceName, setServiceName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('JPY');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [category, setCategory] = useState<CategoryOption | null>(null);
  // プラン選択（複数価格帯のあるサービス用）
  const [availablePlans, setAvailablePlans] = useState<PricingPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState('');
  const [trialEndDate, setTrialEndDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [memo, setMemo] = useState('');
  const [customCancelUrl, setCustomCancelUrl] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSelectSuggestion = (entry: ServiceDictionaryEntry) => {
    setCategory(entry.category);
    setBillingCycle(entry.defaultBillingCycle);
    if (entry.defaultAmount !== null) {
      setAmount(String(entry.defaultAmount));
    }
    // USD/JPY を問わず常にリセット（JPY サービス選択後も USD が残り続けるバグを防ぐ）
    setCurrency(entry.currency ?? 'JPY');
    if (entry.officialCancelUrl) {
      setCustomCancelUrl(entry.officialCancelUrl);
    }
    // 複数プランがある場合: defaultAmount に対応するプランを初期選択
    if (entry.plans && entry.plans.length > 0) {
      setAvailablePlans(entry.plans);
      const defaultIdx = entry.plans.findIndex((p) => p.amount === entry.defaultAmount);
      setSelectedPlanIndex(defaultIdx >= 0 ? defaultIdx : 0);
    } else {
      setAvailablePlans([]);
      setSelectedPlanIndex(null);
    }
  };

  // サービス名を手入力で変更したとき、プラン選択をリセット
  const handleServiceNameChange = (text: string) => {
    setServiceName(text);
    if (availablePlans.length > 0) {
      setAvailablePlans([]);
      setSelectedPlanIndex(null);
    }
  };

  const handleSave = async () => {
    const nextErrors = validateSubscriptionForm({
      serviceName,
      billingCycle,
      amount,
      currency,
      nextRenewalDate,
      trialEndDate,
      startDate,
      customCancelUrl,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    const formData: SubscriptionFormData = {
      serviceName: serviceName.trim(),
      amount: billingCycle === 'free' ? 0 : Number(amount),
      currency: billingCycle === 'free' ? undefined : currency,
      billingCycle,
      category,
      status: 'active',
      nextRenewalDate: nextRenewalDate || null,
      trialEndDate: trialEndDate || null,
      startDate: startDate || null,
      memo: memo || null,
      cancelMemo: null,
      customCancelUrl: customCancelUrl.trim() || null,
      isArchived: false,
    };

    const result = await save(formData);
    setIsSaving(false);

    if (result.ok) {
      router.back();
    } else if (result.error === 'limit_reached') {
      Alert.alert(
        '登録上限に達しました',
        `最大${FREE_LIMIT_COUNT}件まで登録できます。\n一覧から外すと空きができます。`,
        [{ text: 'OK' }],
      );
    } else {
      Alert.alert('エラー', '保存できませんでした。もう一度試してください。');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>新規登録</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>基本情報</Text>
          <View style={styles.section}>
            <ServiceNameAutocomplete
              label="サービス名 *"
              value={serviceName}
              onChangeText={handleServiceNameChange}
              onSelectSuggestion={handleSelectSuggestion}
              placeholder="Netflix, Spotify..."
              error={errors.serviceName}
              maxLength={50}
            />
            {/* プラン選択チップ（複数価格帯があるサービスのみ表示） */}
            {availablePlans.length > 0 && (
              <View style={styles.planSection}>
                <Text style={styles.planLabel}>プラン</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.planChipsRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {availablePlans.map((plan, i) => {
                    const active = selectedPlanIndex === i;
                    const priceStr = plan.currency === 'USD'
                      ? `$${plan.amount}`
                      : `¥${plan.amount.toLocaleString()}`;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.planChip, active && styles.planChipActive]}
                        onPress={() => {
                          setSelectedPlanIndex(i);
                          setAmount(String(plan.amount));
                          if (plan.billingCycle) setBillingCycle(plan.billingCycle);
                          if (plan.currency) setCurrency(plan.currency);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.planChipLabel, active && styles.planChipLabelActive]}>
                          {plan.label}
                        </Text>
                        <Text style={[styles.planChipPrice, active && styles.planChipPriceActive]}>
                          {priceStr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <SelectField
              label="支払いサイクル *"
              value={billingCycle}
              options={BILLING_CYCLE_OPTIONS}
              displayLabel={(v) => BILLING_CYCLE_LABELS[v]}
              onChange={(v) => v && setBillingCycle(v)}
            />
            <AmountField
              billingCycle={billingCycle}
              amount={amount}
              currency={currency}
              onChangeAmount={setAmount}
              onToggleCurrency={() => setCurrency((c) => (c === 'JPY' ? 'USD' : 'JPY'))}
              error={errors.amount}
            />
          </View>

          <Text style={styles.sectionTitle}>詳細（任意）</Text>
          <View style={styles.section}>
            <SelectField
              label="カテゴリ"
              value={category}
              options={CATEGORY_OPTIONS}
              displayLabel={(v) => v}
              onChange={setCategory}
              clearable
            />
            <DatePickerField
              label="次回更新日"
              value={nextRenewalDate}
              onChange={setNextRenewalDate}
              error={errors.nextRenewalDate}
            />
            <DatePickerField
              label="トライアル終了日"
              value={trialEndDate}
              onChange={setTrialEndDate}
              error={errors.trialEndDate}
            />
            <DatePickerField
              label="利用開始日"
              value={startDate}
              onChange={setStartDate}
              error={errors.startDate}
            />
          </View>

          <Text style={styles.sectionTitle}>メモ・解約URL</Text>
          <View style={styles.section}>
            <TextInput
              label="解約URL"
              value={customCancelUrl}
              onChangeText={setCustomCancelUrl}
              placeholder="https://..."
              autoCapitalize="none"
              keyboardType="url"
              error={errors.customCancelUrl}
            />
            <TextInput
              label="メモ（任意）"
              value={memo}
              onChangeText={setMemo}
              placeholder="自由にメモ..."
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="登録する" onPress={handleSave} loading={isSaving} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  scroll: { padding: 16, gap: 8, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginTop: 8,
    marginBottom: 4,
  },
  section: {
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    overflow: 'visible',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  planSection: {
    gap: 6,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  planChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  planChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 1,
  },
  planChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  planChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  planChipLabelActive: {
    color: '#FFFFFF',
  },
  planChipPrice: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  planChipPriceActive: {
    color: 'rgba(255,255,255,0.8)',
  },
});
