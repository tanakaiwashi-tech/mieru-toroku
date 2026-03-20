import { GMAIL_SENDER_PATTERNS, type GmailSenderPattern } from '@/src/constants/gmailSenders';

/** スキャン結果の候補1件 */
export interface GmailCandidate {
  /** マッチしたサービスパターン */
  pattern: GmailSenderPattern;
  /** 最新メールの件名 */
  subject: string;
  /** 最新メールの差出人 */
  from: string;
  /** 最新メールの日付文字列 */
  date: string;
  /** 直近3ヶ月でこのサービスからのメール件数 */
  matchCount: number;
}

interface MessageMeta {
  subject: string;
  from: string;
  date: string;
}

/**
 * Googleアカウントにポップアップでサインインし、アクセストークンを返す。
 * - スコープ: gmail.readonly（件名・差出人・日付のみ取得）
 * - トークンはメモリのみ保持（LocalStorageへの書き込みなし）
 */
export async function signInWithGoogle(): Promise<string> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  if (!clientId) {
    throw new Error('Google Client IDが設定されていません（EXPO_PUBLIC_GOOGLE_CLIENT_ID）');
  }

  const redirectUri = window.location.origin + '/oauth-callback.html';
  const scope = 'https://www.googleapis.com/auth/gmail.readonly';

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scope)}` +
    `&prompt=consent`;

  return new Promise((resolve, reject) => {
    const popup = window.open(
      authUrl,
      'google-oauth',
      'width=500,height=650,left=300,top=100',
    );

    if (!popup) {
      reject(new Error('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。'));
      return;
    }

    // oauth-callback.html からのpostMessageでトークンを受け取る
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'oauth_callback') return;
      cleanup();
      const hash: string = event.data.hash ?? '';
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get('access_token');
      if (token) {
        resolve(token);
      } else {
        reject(new Error('アクセストークンの取得に失敗しました'));
      }
    };

    // ポップアップが手動で閉じられた場合を検知
    const closedTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('ログインがキャンセルされました'));
      }
    }, 500);

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearInterval(closedTimer);
      clearTimeout(timeoutId);
      if (!popup.closed) popup.close();
    };

    window.addEventListener('message', onMessage);

    // 5分でタイムアウト
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('ログインがタイムアウトしました'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Gmail APIでメタデータを取得し、サブスク候補リストを返す。
 * クエリなしで直近メールを取得し、JavaScriptで差出人ドメインを絞り込む。
 * （gmail.metadata スコープでの検索クエリ制限を回避するため）
 */
export async function scanGmailForSubscriptions(
  accessToken: string,
): Promise<GmailCandidate[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  // INBOXの直近200件を取得（クエリなし・スコープ制限を回避）
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&labelIds=INBOX`,
    { headers },
  );

  if (!res.ok) {
    if (res.status === 401) throw new Error('認証の有効期限が切れました。再スキャンしてください。');
    const body = await res.text().catch(() => '');
    throw new Error(`Gmailの取得に失敗しました（${res.status}）${body ? ': ' + body : ''}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  const messages = data.messages ?? [];

  if (messages.length === 0) {
    throw new Error('受信トレイにメールが見つかりませんでした。スコープの権限を確認してください。');
  }

  // メタデータを取得してドメイン照合
  const metaList = await fetchMessagesMetadata(messages.slice(0, 100), accessToken);
  return matchCandidates(metaList);
}

/** メッセージIDリストからメタデータ（件名・差出人・日付）を並列取得 */
async function fetchMessagesMetadata(
  messages: { id: string }[],
  accessToken: string,
): Promise<MessageMeta[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const results: MessageMeta[] = [];

  // 20件ずつチャンク処理（レート制限を考慮）
  for (let i = 0; i < messages.length; i += 20) {
    const chunk = messages.slice(i, i + 20);
    const fetched = await Promise.all(
      chunk.map(async ({ id }) => {
        try {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
              `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers },
          );
          if (!res.ok) return null;
          const data = (await res.json()) as {
            payload?: { headers?: { name: string; value: string }[] };
          };
          const hdrs = data.payload?.headers ?? [];
          const get = (name: string) =>
            hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
          return { subject: get('Subject'), from: get('From'), date: get('Date') };
        } catch {
          return null;
        }
      }),
    );
    results.push(...fetched.filter((m): m is MessageMeta => m !== null));
  }

  return results;
}

/** From ヘッダーからドメイン部分を抽出する */
function extractDomain(from: string): string {
  // "Name <email@domain.com>" または "email@domain.com" の両形式に対応
  const match = from.match(/@([^>"\s]+)/);
  return match ? match[1].toLowerCase() : '';
}

/** メタデータリストをパターン辞書と照合し、候補リストを生成する */
function matchCandidates(metaList: MessageMeta[]): GmailCandidate[] {
  // パターンのnormalizedNameをキーに集計
  const patternMap = new Map<string, { pattern: GmailSenderPattern; metas: MessageMeta[] }>();

  for (const meta of metaList) {
    const domain = extractDomain(meta.from);
    if (!domain) continue;

    for (const pattern of GMAIL_SENDER_PATTERNS) {
      if (domain.includes(pattern.senderDomain)) {
        const key = pattern.normalizedName;
        if (!patternMap.has(key)) {
          patternMap.set(key, { pattern, metas: [] });
        }
        patternMap.get(key)!.metas.push(meta);
        break; // 最初にマッチしたパターンのみ使用
      }
    }
  }

  // 各サービスの最新メールを代表として候補を作成
  const candidates: GmailCandidate[] = [];
  for (const { pattern, metas } of patternMap.values()) {
    candidates.push({
      pattern,
      subject: metas[0].subject, // Gmail APIは新しい順に返す
      from: metas[0].from,
      date: metas[0].date,
      matchCount: metas.length,
    });
  }

  // メール件数の多い順（利用頻度が高い順）にソート
  return candidates.sort((a, b) => b.matchCount - a.matchCount);
}
