import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/colors';
import { useSubscriptionStore } from '@/src/stores/subscriptionStore';
import { useUiPrefsStore } from '@/src/stores/uiPrefsStore';
import {
  exportSubscriptionsAsJSON,
  exportSubscriptionsAsCSV,
  parseImportFile,
  type ExportData,
} from '@/src/utils/exportUtils';

type ImportPhase =
  | { phase: 'idle' }
  | { phase: 'previewing'; data: ExportData }
  | { phase: 'error'; message: string };

function formatScanDate(iso: string | null): string {
  if (!iso) return 'なし';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${min}`;
}

export default function SettingsScreen() {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const importSubscriptions = useSubscriptionStore((s) => s.importSubscriptions);
  const lastGmailScanAt = useUiPrefsStore((s) => s.lastGmailScanAt);
  const [isExporting, setIsExporting] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>({ phase: 'idle' });

  // ─── JSON エクスポート ───────────────────────────────────────
  const handleExportJSON = () => {
    if (subscriptions.length === 0) {
      Alert.alert('エクスポート', '登録データがありません。');
      return;
    }
    Alert.alert(
      'JSONでエクスポート',
      `${subscriptions.length}件のデータをJSONファイルでダウンロードします。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ダウンロード',
          onPress: () => {
            try {
              setIsExporting(true);
              exportSubscriptionsAsJSON(subscriptions);
            } catch {
              Alert.alert('エラー', 'エクスポートに失敗しました。');
            } finally {
              setIsExporting(false);
            }
          },
        },
      ],
    );
  };

  // ─── CSV エクスポート ────────────────────────────────────────
  const handleExportCSV = () => {
    if (subscriptions.length === 0) {
      Alert.alert('エクスポート', '登録データがありません。');
      return;
    }
    Alert.alert(
      'CSVでエクスポート',
      `${subscriptions.length}件をCSVファイルでダウンロードします。\nExcelなどの表計算ソフトで開けます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ダウンロード',
          onPress: () => {
            try {
              exportSubscriptionsAsCSV(subscriptions);
            } catch {
              Alert.alert('エラー', 'エクスポートに失敗しました。');
            }
          },
        },
      ],
    );
  };

  // ─── インポート ──────────────────────────────────────────────
  const triggerImportPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await parseImportFile(file);
        setImportPhase({ phase: 'previewing', data });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。';
        setImportPhase({ phase: 'error', message: msg });
      }
    };
    input.click();
  };

  const executeImport = (mode: 'merge' | 'replace') => {
    if (importPhase.phase !== 'previewing') return;
    const count = importPhase.data.subscriptionCount;
    importSubscriptions(mode, importPhase.data.subscriptions);
    setImportPhase({ phase: 'idle' });
    Alert.alert(
      'インポート完了',
      mode === 'replace'
        ? `${count}件のデータで置き換えました。`
        : `${count}件を追加しました。`,
    );
  };

  const cancelImport = () => setImportPhase({ phase: 'idle' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Gmail連携 */}
        <Text style={styles.groupLabel}>Gmail連携</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => router.push('/(main)/gmail-scan')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="mail-outline" size={19} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowLabel}>Gmailからサブスクを探す</Text>
                <Text style={styles.rowDesc}>件名・差出人のみ読み取り。本文は読みません</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="time-outline" size={19} color={COLORS.textMuted} />
              </View>
              <Text style={styles.rowLabel}>最終スキャン日時</Text>
            </View>
            <Text style={styles.rowValue}>{formatScanDate(lastGmailScanAt)}</Text>
          </View>
        </View>

        {/* データ管理 */}
        <Text style={[styles.groupLabel, styles.groupLabelGap]}>データ管理</Text>

        {/* エクスポート推奨バナー */}
        <View style={styles.exportReminder}>
          <Ionicons name="warning-outline" size={14} color={COLORS.warning.text} />
          <Text style={styles.exportReminderText}>
            ブラウザのデータ消去でデータが消えます。定期的なエクスポートをおすすめします。
          </Text>
        </View>

        <View style={styles.group}>

          {/* JSON エクスポート */}
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={handleExportJSON}
            activeOpacity={0.7}
            disabled={isExporting}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="download-outline" size={19} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowLabel}>JSONでエクスポート</Text>
                <Text style={styles.rowDesc}>
                  {subscriptions.length === 0
                    ? 'まだ登録がありません'
                    : `${subscriptions.length}件 — バックアップ用`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* CSV エクスポート */}
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={handleExportCSV}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="grid-outline" size={19} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowLabel}>CSVでエクスポート</Text>
                <Text style={styles.rowDesc}>Excel・スプレッドシートで開ける形式</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* インポート */}
          <TouchableOpacity
            style={styles.row}
            onPress={triggerImportPicker}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="push-outline" size={19} color={COLORS.primary} />
              </View>
              <View style={styles.rowTexts}>
                <Text style={styles.rowLabel}>データをインポート</Text>
                <Text style={styles.rowDesc}>バックアップJSONから復元する</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {'JSONエクスポートしたファイルを使ってデータを復元できます。\nブラウザのデータ消去前にエクスポートしておくと安心です。'}
        </Text>

        {/* インポートエラーカード */}
        {importPhase.phase === 'error' && (
          <View style={styles.importErrorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.destructive} />
            <Text style={styles.importErrorText}>{importPhase.message}</Text>
            <TouchableOpacity onPress={cancelImport} style={styles.importCancelBtn} activeOpacity={0.7}>
              <Text style={styles.importCancelText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* インポートプレビューカード */}
        {importPhase.phase === 'previewing' && (
          <View style={styles.importPreviewCard}>
            <Text style={styles.importPreviewTitle}>
              {`${importPhase.data.subscriptionCount}件のデータが見つかりました`}
            </Text>
            <Text style={styles.importPreviewDesc}>インポート方法を選んでください</Text>
            <View style={styles.importButtons}>
              <TouchableOpacity
                style={[styles.importBtn, styles.importBtnMerge]}
                onPress={() => executeImport('merge')}
                activeOpacity={0.75}
              >
                <Text style={styles.importBtnMergeText}>追加する</Text>
                <Text style={styles.importBtnSub}>既存データに追加</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importBtn, styles.importBtnReplace]}
                onPress={() => executeImport('replace')}
                activeOpacity={0.75}
              >
                <Text style={styles.importBtnReplaceText}>置き換える</Text>
                <Text style={styles.importBtnSub}>全データを上書き</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={cancelImport} style={styles.importCancelBtn} activeOpacity={0.7}>
              <Text style={styles.importCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* このアプリについて */}
        <Text style={[styles.groupLabel, styles.groupLabelGap]}>このアプリについて</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={[styles.row, styles.rowBorder]}
            onPress={() => router.push('/privacy')}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="shield-checkmark-outline" size={19} color={COLORS.primary} />
              </View>
              <Text style={styles.rowLabel}>プライバシーポリシー</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrap}>
                <Ionicons name="information-circle-outline" size={19} color={COLORS.textMuted} />
              </View>
              <Text style={styles.rowLabel}>バージョン</Text>
            </View>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
        </View>

      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  scroll: { padding: 16, paddingBottom: 48 },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  groupLabelGap: { marginTop: 28 },
  group: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  rowDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  exportReminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.warning.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.warning.border,
    padding: 10,
    marginBottom: 8,
  },
  exportReminderText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning.text,
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  // ─── インポートカード ───
  importPreviewCard: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  importPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  importPreviewDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  importButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  importBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
  },
  importBtnMerge: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  importBtnMergeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  importBtnReplace: {
    backgroundColor: COLORS.destructiveLight,
    borderColor: COLORS.destructiveBorder,
  },
  importBtnReplaceText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.destructive,
  },
  importBtnSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  importCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  importCancelText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  importErrorCard: {
    marginTop: 12,
    backgroundColor: COLORS.destructiveLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.destructiveBorder,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  importErrorText: {
    fontSize: 13,
    color: COLORS.destructive,
    textAlign: 'center',
    lineHeight: 20,
  },
});
