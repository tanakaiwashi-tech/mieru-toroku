import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { useUiPrefsStore } from '@/src/stores/uiPrefsStore';
import {
  signInWithGoogle,
  scanGmailForSubscriptions,
  type GmailCandidate,
} from '@/src/utils/gmailUtils';
import type { SubscriptionFormData } from '@/src/types';
import type { GmailSenderPattern } from '@/src/constants/gmailSenders';

type ScanPhase =
  | { phase: 'idle' }
  | { phase: 'signing_in' }
  | { phase: 'scanning' }
  | { phase: 'done'; candidates: GmailCandidate[] }
  | { phase: 'error'; message: string };

interface CandidateDetail {
  amount: string;
  billingCycle: 'monthly' | 'yearly';
  currency: 'JPY' | 'USD';
}

export default function GmailScanScreen() {
  const add = useSubscriptionStore((s) => s.add);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const setLastGmailScanAt = useUiPrefsStore((s) => s.setLastGmailScanAt);

  const [scanPhase, setScanPhase] = useState<ScanPhase>({ phase: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Map<string, CandidateDetail>>(new Map());
  const [isRegistering, setIsRegistering] = useState(false);

  // ─── スキャン開始 ──────────────────────────────────────────────
  const handleScan = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('未対応', 'この機能はWebブラウザでのみ使用できます。');
      return;
    }

    try {
      setScanPhase({ phase: 'signing_in' });
      const token = await signInWithGoogle();

      setScanPhase({ phase: 'scanning' });
      const candidates = await scanGmailForSubscriptions(token);

      setScanPhase({ phase: 'done', candidates });
      setLastGmailScanAt(new Date().toISOString());
      setSelected(new Set());
      setDetails(new Map());
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setScanPhase({ phase: 'error', message });
    }
  };

  // ─── 既存登録済みチェック ─────────────────────────────────────
  const registeredNames = new Set(
    subscriptions.map((s) => s.serviceName.toLowerCase().trim()),
  );
  const isAlreadyRegistered = (displayName: string) =>
    registeredNames.has(displayName.toLowerCase().trim());

  // ─── 選択トグル ───────────────────────────────────────────────
  const toggleSelect = (key: string, pattern: GmailSenderPattern) => {
    const isCurrentlySelected = selected.has(key);

    setSelected((prev) => {
      const next = new Set(prev);
      if (isCurrentlySelected) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    setDetails((prev) => {
      const next = new Map(prev);
      if (isCurrentlySelected) {
        next.delete(key);
      } else {
        next.set(key, {
          amount: pattern.defaultAmount ? String(pattern.defaultAmount) : '',
          billingCycle: pattern.defaultBillingCycle ?? 'monthly',
          currency: pattern.defaultCurrency ?? 'JPY',
        });
      }
      return next;
    });
  };

  // ─── 詳細更新 ─────────────────────────────────────────────────
  const updateDetail = (key: string, updates: Partial<CandidateDetail>) => {
    setDetails((prev) => {
      const next = new Map(prev);
      const current = next.get(key);
      if (!current) return prev;
      next.set(key, { ...current, ...updates });
      return next;
    });
  };

  // ─── 選択した候補を登録 ───────────────────────────────────────
  const handleRegister = async () => {
    if (scanPhase.phase !== 'done' || isRegistering) return;

    const targets = scanPhase.candidates.filter(
      (c) =>
        selected.has(c.pattern.normalizedName) &&
        !isAlreadyRegistered(c.pattern.displayName),
    );

    if (targets.length === 0) {
      Alert.alert('確認', '新しく登録できるサービスがありません（すでに登録済みです）。');
      return;
    }

    setIsRegistering(true);
    let successCount = 0;

    for (const candidate of targets) {
      const key = candidate.pattern.normalizedName;
      const detail = details.get(key);
      const amount = parseInt(detail?.amount ?? '0', 10);

      const formData: SubscriptionFormData = {
        serviceName: candidate.pattern.displayName,
        amount: isNaN(amount) ? 0 : amount,
        currency: detail?.currency ?? 'JPY',
        billingCycle: detail?.billingCycle ?? 'monthly',
        category: candidate.pattern.defaultCategory ?? null,
        status: 'active',
        nextRenewalDate: null,
        trialEndDate: null,
        startDate: null,
        memo: null,
        cancelMemo: null,
        customCancelUrl: null,
        isArchived: false,
      };
      const result = add(formData);
      if (result.ok) successCount++;
    }

    setIsRegistering(false);
    setSelected(new Set());
    setDetails(new Map());

    const hasUnsetAmount = targets.some((c) => {
      const amt = details.get(c.pattern.normalizedName)?.amount ?? '';
      return amt === '' || amt === '0';
    });

    Alert.alert(
      '登録完了',
      `${successCount}件を登録しました。${hasUnsetAmount ? '\n金額が未設定の項目は詳細画面から編集できます。' : ''}`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  // ─── レンダリング ──────────────────────────────────────────────
  const candidates = scanPhase.phase === 'done' ? scanPhase.candidates : [];
  const isLoading =
    scanPhase.phase === 'signing_in' || scanPhase.phase === 'scanning';

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gmailからサブスクを探す</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* 説明文 */}
        <View style={styles.descCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <Text style={styles.descText}>
            Gmailの<Text style={styles.bold}>件名と差出人だけ</Text>を読み取り、サブスク候補を探します。メール本文は読みません。
          </Text>
        </View>

        {/* Google警告の事前説明 */}
        {(scanPhase.phase === 'idle' || scanPhase.phase === 'error') && (
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.tipText}>
              ログイン時に<Text style={styles.tipBold}>「確認されていないアプリ」</Text>と表示されますが正常です。「詳細」→「続行」と進んでください。
            </Text>
          </View>
        )}

        {/* スキャンボタン */}
        {(scanPhase.phase === 'idle' || scanPhase.phase === 'error') && (
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text style={styles.scanBtnText}>Gmailをスキャンする</Text>
          </TouchableOpacity>
        )}

        {/* ローディング */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {scanPhase.phase === 'signing_in'
                ? 'Googleにログイン中...'
                : 'メールを検索中（直近3ヶ月）...'}
            </Text>
          </View>
        )}

        {/* エラー */}
        {scanPhase.phase === 'error' && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.destructive} />
            <Text style={styles.errorText}>{scanPhase.message}</Text>
          </View>
        )}

        {/* 結果: 件数 */}
        {scanPhase.phase === 'done' && (
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>
              {candidates.length > 0
                ? `${candidates.length}件のサブスク候補が見つかりました`
                : '候補が見つかりませんでした'}
            </Text>
            {candidates.length > 0 && (
              <Text style={styles.resultSub}>
                タップして選択し、金額・サイクルを確認してから登録できます
              </Text>
            )}
          </View>
        )}

        {/* 候補リスト */}
        {candidates.map((candidate) => {
          const key = candidate.pattern.normalizedName;
          const isSelected = selected.has(key);
          const alreadyRegistered = isAlreadyRegistered(candidate.pattern.displayName);
          const detail = details.get(key);

          return (
            <View
              key={key}
              style={[
                styles.candidateCard,
                isSelected && styles.candidateCardSelected,
                alreadyRegistered && styles.candidateCardRegistered,
              ]}
            >
              {/* カードヘッダー（タップで選択） */}
              <TouchableOpacity
                style={styles.candidateHeader}
                onPress={() => !alreadyRegistered && toggleSelect(key, candidate.pattern)}
                activeOpacity={alreadyRegistered ? 1 : 0.7}
              >
                <View style={styles.candidateLeft}>
                  {alreadyRegistered ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  ) : (
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                  )}
                </View>
                <View style={styles.candidateBody}>
                  <View style={styles.candidateNameRow}>
                    <Text style={styles.candidateName}>{candidate.pattern.displayName}</Text>
                    {alreadyRegistered && (
                      <View style={styles.registeredBadge}>
                        <Text style={styles.registeredBadgeText}>登録済み</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.candidateFrom} numberOfLines={1}>
                    {candidate.from}
                  </Text>
                </View>
                <View style={styles.candidateRight}>
                  <Text style={styles.candidateCount}>{candidate.matchCount}通</Text>
                </View>
              </TouchableOpacity>

              {/* インライン入力（選択時のみ展開） */}
              {isSelected && !alreadyRegistered && detail && (
                <View style={styles.inlineInputs}>
                  {/* 支払いサイクル */}
                  <View style={styles.cycleRow}>
                    <Text style={styles.inlineLabel}>サイクル</Text>
                    <TouchableOpacity
                      style={[
                        styles.cycleBtn,
                        detail.billingCycle === 'monthly' && styles.cycleBtnActive,
                      ]}
                      onPress={() => updateDetail(key, { billingCycle: 'monthly' })}
                    >
                      <Text
                        style={[
                          styles.cycleBtnText,
                          detail.billingCycle === 'monthly' && styles.cycleBtnTextActive,
                        ]}
                      >
                        月額
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.cycleBtn,
                        detail.billingCycle === 'yearly' && styles.cycleBtnActive,
                      ]}
                      onPress={() => updateDetail(key, { billingCycle: 'yearly' })}
                    >
                      <Text
                        style={[
                          styles.cycleBtnText,
                          detail.billingCycle === 'yearly' && styles.cycleBtnTextActive,
                        ]}
                      >
                        年額
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 通貨 */}
                  <View style={styles.cycleRow}>
                    <Text style={styles.inlineLabel}>通貨</Text>
                    <TouchableOpacity
                      style={[
                        styles.cycleBtn,
                        detail.currency === 'JPY' && styles.cycleBtnActive,
                      ]}
                      onPress={() => updateDetail(key, { currency: 'JPY' })}
                    >
                      <Text
                        style={[
                          styles.cycleBtnText,
                          detail.currency === 'JPY' && styles.cycleBtnTextActive,
                        ]}
                      >
                        ¥ JPY
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.cycleBtn,
                        detail.currency === 'USD' && styles.cycleBtnActive,
                      ]}
                      onPress={() => updateDetail(key, { currency: 'USD' })}
                    >
                      <Text
                        style={[
                          styles.cycleBtnText,
                          detail.currency === 'USD' && styles.cycleBtnTextActive,
                        ]}
                      >
                        $ USD
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 金額入力 */}
                  <View style={styles.amountRow}>
                    <Text style={styles.inlineLabel}>金額</Text>
                    <Text style={styles.yenSymbol}>
                      {detail.currency === 'USD' ? '$' : '¥'}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      value={detail.amount}
                      onChangeText={(v) =>
                        updateDetail(key, { amount: v.replace(/[^0-9]/g, '') })
                      }
                      keyboardType="numeric"
                      placeholder="未設定"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    {detail.amount === '' && (
                      <Text style={styles.amountHint}>（後で編集できます）</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* 再スキャンリンク */}
        {scanPhase.phase === 'done' && (
          <TouchableOpacity style={styles.rescanBtn} onPress={handleScan}>
            <Text style={styles.rescanText}>再スキャンする</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* 登録ボタン（候補選択時のみ表示） */}
      {selected.size > 0 && (
        <View style={styles.registerBar}>
          <TouchableOpacity
            style={[styles.registerBtn, isRegistering && styles.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>
                {selected.size}件を登録する
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    padding: 4,
    width: 36,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerRight: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  descCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  descText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  tipCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  tipBold: {
    fontWeight: '600',
    color: COLORS.text,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  scanBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingCard: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.destructiveLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.destructive,
    lineHeight: 20,
  },
  resultHeader: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  resultSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  // ─── カード ───────────────────────────────────────────────────
  candidateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  candidateCardSelected: {
    borderColor: COLORS.primary,
  },
  candidateCardRegistered: {
    opacity: 0.6,
  },
  candidateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  candidateLeft: {
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  candidateBody: {
    flex: 1,
    gap: 2,
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  candidateName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  registeredBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  registeredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  candidateFrom: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  candidateRight: {
    marginLeft: 8,
  },
  candidateCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // ─── インライン入力 ───────────────────────────────────────────
  inlineInputs: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  inlineLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 48,
    fontWeight: '500',
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cycleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cycleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cycleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  cycleBtnTextActive: {
    color: '#fff',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yenSymbol: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  amountInput: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.primary,
    minWidth: 80,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  amountHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // ─── その他 ───────────────────────────────────────────────────
  rescanBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  rescanText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  bottomPad: {
    height: 100,
  },
  registerBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  registerBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerBtnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
