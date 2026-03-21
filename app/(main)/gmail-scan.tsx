import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import {
  signInWithGoogle,
  scanGmailForSubscriptions,
  type GmailCandidate,
} from '@/src/utils/gmailUtils';
import type { SubscriptionFormData } from '@/src/types';

type ScanPhase =
  | { phase: 'idle' }
  | { phase: 'signing_in' }
  | { phase: 'scanning' }
  | { phase: 'done'; candidates: GmailCandidate[] }
  | { phase: 'error'; message: string };

export default function GmailScanScreen() {
  const add = useSubscriptionStore((s) => s.add);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const [scanPhase, setScanPhase] = useState<ScanPhase>({ phase: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      setSelected(new Set());
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setScanPhase({ phase: 'error', message });
    }
  };

  // ─── 選択トグル ───────────────────────────────────────────────
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // ─── 既存登録済みチェック ─────────────────────────────────────
  const registeredNames = new Set(
    subscriptions.map((s) => s.serviceName.toLowerCase().trim()),
  );
  const isAlreadyRegistered = (displayName: string) =>
    registeredNames.has(displayName.toLowerCase().trim());

  // ─── 選択した候補を登録 ───────────────────────────────────────
  const handleRegister = async () => {
    if (scanPhase.phase !== 'done' || isRegistering) return;
    const targets = scanPhase.candidates.filter((c) =>
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
      const formData: SubscriptionFormData = {
        serviceName: candidate.pattern.displayName,
        amount: 0,
        currency: 'JPY',
        billingCycle: 'monthly',
        category: null,
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
    Alert.alert(
      '登録完了',
      `${successCount}件を登録しました。\n金額・更新日は詳細画面から編集してください。`,
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
            Gmailの<Text style={styles.bold}>件名と差出人だけ</Text>を読み取り、サブスク候補を探します。メール本文は読みません。見つかった候補はあなたが確認してから登録できます。
          </Text>
        </View>

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
            <Text style={styles.errorText}>{scanPhase.phase === 'error' ? scanPhase.message : ''}</Text>
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
                チェックを入れてまとめて登録できます
              </Text>
            )}
          </View>
        )}

        {/* 候補リスト */}
        {candidates.map((candidate) => {
          const key = candidate.pattern.normalizedName;
          const isSelected = selected.has(key);
          const alreadyRegistered = isAlreadyRegistered(candidate.pattern.displayName);
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.candidateCard,
                isSelected && styles.candidateCardSelected,
                alreadyRegistered && styles.candidateCardRegistered,
              ]}
              onPress={() => !alreadyRegistered && toggleSelect(key)}
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
                <Text style={styles.candidateSubject} numberOfLines={1}>
                  {candidate.subject}
                </Text>
              </View>
              <View style={styles.candidateRight}>
                <Text style={styles.candidateCount}>{candidate.matchCount}通</Text>
              </View>
            </TouchableOpacity>
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
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  candidateCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  candidateCardRegistered: {
    opacity: 0.6,
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
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
  candidateName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  candidateFrom: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  candidateSubject: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  candidateRight: {
    marginLeft: 8,
  },
  candidateCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
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
