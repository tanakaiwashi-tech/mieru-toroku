import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '@/src/constants/colors';
import type { ServiceDictionaryEntry } from '@/src/types';
import serviceDictionary from '@/src/services/remoteConfig/fallback/service_dictionary.json';

const ENTRIES = serviceDictionary.entries as ServiceDictionaryEntry[];
const MAX_SUGGESTIONS = 6;

/** カタカナ → ひらがな変換 */
function toHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}

/** 入力がひらがな・カタカナを含むか */
function hasKana(str: string): boolean {
  return /[\u3041-\u30FF]/.test(str);
}

/**
 * 検索スコアを計算する（小さいほど上位）
 * matchType (×1000) + popularityRank で優先度を決定:
 *   0: 名前の先頭一致 / reading の先頭一致（かな入力時）
 *   1: 正規化名の先頭一致
 *   2: 名前の部分一致 / reading の部分一致（かな入力時）
 *   3: 正規化名の部分一致
 */
function calcScore(entry: ServiceDictionaryEntry, query: string): number {
  const r = entry.popularityRank;

  if (hasKana(query)) {
    const q = toHiragana(query);
    const reading = toHiragana(entry.reading);
    if (reading.startsWith(q)) return 0 * 1000 + r;
    if (reading.includes(q))   return 2 * 1000 + r;
    return Infinity;
  }

  const q = query.toLowerCase();
  const qNorm = q.replace(/\s+/g, '');
  const name = entry.name.toLowerCase();
  const norm = entry.normalizedName;

  if (name.startsWith(q))     return 0 * 1000 + r;
  if (norm.startsWith(qNorm)) return 1 * 1000 + r;
  if (name.includes(q))       return 2 * 1000 + r;
  if (norm.includes(qNorm))   return 3 * 1000 + r;
  return Infinity;
}

function getSuggestions(query: string): ServiceDictionaryEntry[] {
  if (query.trim().length === 0) return [];
  return ENTRIES
    .map((e) => ({ entry: e, score: calcScore(e, query) }))
    .filter(({ score }) => score !== Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ entry }) => entry);
}

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectSuggestion: (entry: ServiceDictionaryEntry) => void;
  error?: string;
  placeholder?: string;
  maxLength?: number;
}

export function ServiceNameAutocomplete({
  label,
  value,
  onChangeText,
  onSelectSuggestion,
  error,
  placeholder,
  maxLength,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  // ラベル + 入力欄の実際の高さを onLayout で計測し、ドロップダウンの top に使う
  const [inputAreaHeight, setInputAreaHeight] = useState(label ? 72 : 46);
  const inputRef = useRef<RNTextInput>(null);

  const suggestions = getSuggestions(value);

  const handleSelect = (entry: ServiceDictionaryEntry) => {
    onChangeText(entry.name);
    onSelectSuggestion(entry);
    setShowSuggestions(false);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    // エラーテキスト非表示時も含め、4px のバッファで余裕を持たせる
    setInputAreaHeight(e.nativeEvent.layout.height + 4);
  };

  const visible = showSuggestions && suggestions.length > 0;

  return (
    <View style={styles.wrapper}>
      <View onLayout={handleLayout}>
        {label && <Text style={styles.label}>{label}</Text>}
        <RNTextInput
          ref={inputRef}
          style={[styles.input, !!error && styles.inputError]}
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          autoCorrect={false}
          maxLength={maxLength}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      {visible && (
        <View style={[styles.dropdown, { top: inputAreaHeight }]}>
          <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={false}>
            {suggestions.map((entry, i) => (
              <TouchableOpacity
                key={entry.id}
                style={[
                  styles.item,
                  i < suggestions.length - 1 && styles.itemBorder,
                ]}
                onPress={() => handleSelect(entry)}
                activeOpacity={0.7}
              >
                <Text style={styles.itemName}>{entry.name}</Text>
                <Text style={styles.itemMeta}>
                  {entry.plans && entry.plans.length > 0
                    ? `${entry.plans.length}プラン`
                    : entry.defaultAmount !== null
                      ? `${entry.currency === 'USD' ? '$' : '¥'}${entry.defaultAmount.toLocaleString()}`
                      : entry.category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.destructive,
  },
  error: {
    fontSize: 12,
    color: COLORS.destructive,
    marginTop: 4,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 200,
  },
  item: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  itemName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
