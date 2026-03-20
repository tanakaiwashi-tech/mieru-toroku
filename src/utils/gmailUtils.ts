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
 * - スコープ: gmail.metadata（件名・差出人・日付のみ）
 * - トークンはメモリのみ保持（LocalStorageへの書き込みなし）
 */
export async function signInWithGoogle(): Promise<string> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  if (!clientId) {
    throw new Error('Google Client IDが設定されていません（EXPO_PUBLIC_GOOGLE_CLIENT_ID）');
  }

  const redirectUri = window.location.origin;
  const scope = 'https://www.googleapis.com/auth/gmail.metadata';

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scope)}` +
    `&prompt=select_account`;

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

    // ポップアップが自サイトにリダイレクトされたらハッシュからトークンを取得
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          reject(new Error('ログインがキャンセルされました'));
          return;
        }
        const hash = popup.location.hash;
        if (hash && hash.includes('access_token')) {
          clearInterval(timer);
          popup.close();
          const params = new URLSearchParams(hash.slice(1));
          const token = params.get('access_token');
          if (token) {
            resolve(token);
          } else {
            reject(new Error('アクセストークンの取得に失敗しました'));
          }
        }
      } catch {
        // Googleのドメイン滞在中はクロスオリジンエラーが出る。無視して継続。
      }
    }, 500);

    // 5分でタイムアウト
    setTimeout(() => {
      clearInterval(timer);
      if (!popup.closed) popup.close();
      reject(new Error('ログインがタイムアウトしました'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Gmail APIでメタデータを取得し、サブスク候補リストを返す。
 * ①差出人ドメイン検索 と ②件名キーワード検索 の2クエリを並列実行し結果をマージする。
 */
export async function scanGmailForSubscriptions(
  accessToken: string,
): Promise<GmailCandidate[]> {
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // ① 辞書の主要ドメインで直接検索（件名不問・直近12ヶ月）
  const topDomains = GMAIL_SENDER_PATTERNS.slice(0, 18).map((p) => `from:${p.senderDomain}`);
  const domainQuery = `(${topDomains.join(' OR ')}) newer_than:12m`;

  // ② 件名キーワード検索（広めのキーワードで直近12ヶ月）
  const subjectQuery =
    '(subject:請求 OR subject:領収 OR subject:料金 OR subject:会費 OR subject:お支払い OR subject:invoice OR subject:billing OR subject:receipt OR subject:payment OR subject:subscription OR subject:renewal) newer_than:12m';

  // 2クエリを並列実行
  const [domainRes, subjectRes] = await Promise.all([
    fetchMessageIds(domainQuery, authHeaders),
    fetchMessageIds(subjectQuery, authHeaders),
  ]);

  if (!domainRes.ok && !subjectRes.ok) {
    const status = domainRes.status;
    if (status === 401) throw new Error('認証の有効期限が切れました。再スキャンしてください。');
    throw new Error(`Gmailの取得に失敗しました（${status}）`);
  }

  // IDを重複排除してマージ
  const seen = new Set<string>();
  const allMessages: { id: string }[] = [];
  for (const msg of [...domainRes.messages, ...subjectRes.messages]) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      allMessages.push(msg);
    }
  }

  if (allMessages.length === 0) return [];

  // 先頭60件のメタデータを取得
  const metaList = await fetchMessagesMetadata(allMessages.slice(0, 60), authHeaders.Authorization.replace('Bearer ', ''));

  return matchCandidates(metaList);
}

/** Gmail messages.list を呼び出してメッセージID一覧を返す */
async function fetchMessageIds(
  query: string,
  headers: { Authorization: string },
): Promise<{ ok: boolean; status: number; messages: { id: string }[] }> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      { headers },
    );
    if (!res.ok) return { ok: false, status: res.status, messages: [] };
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, status: 200, messages: data.messages ?? [] };
  } catch {
    return { ok: false, status: 0, messages: [] };
  }
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
