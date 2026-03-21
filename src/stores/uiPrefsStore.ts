import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '@/src/utils/storageUtils';
import type { SortKey } from '@/src/constants/app';

export interface UiPrefsState {
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  /** Gmailスキャンを最後に完了した日時（ISO文字列）。未スキャンはnull */
  lastGmailScanAt: string | null;
  setLastGmailScanAt: (at: string) => void;
  /** フィルターチップ説明を閉じたかどうか */
  filterTipDismissed: boolean;
  setFilterTipDismissed: (v: boolean) => void;
}

const uiPrefsCreator: StateCreator<UiPrefsState> = (set) => ({
  sortKey: 'createdAt',
  setSortKey: (key: SortKey) => set({ sortKey: key }),
  lastGmailScanAt: null,
  setLastGmailScanAt: (at: string) => set({ lastGmailScanAt: at }),
  filterTipDismissed: false,
  setFilterTipDismissed: (v: boolean) => set({ filterTipDismissed: v }),
});

export const useUiPrefsStore = create<UiPrefsState>()(
  persist(uiPrefsCreator, {
    name: 'mieru-toroku-ui-prefs',
    storage: createJSONStorage(() => safeStorage),
  }),
);
