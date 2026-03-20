/**
 * サービスの normalizedName → ファビコン取得用ドメイン のマッピング
 * Google Favicon API (sz=64) でロゴを取得する。
 * ここに載っていないサービスは頭文字アバターにフォールバックする。
 */
const SERVICE_LOGO_DOMAINS: Record<string, string> = {
  // 動画配信
  amazonprime:             'amazon.co.jp',
  netflix:                 'netflix.com',
  youtubepremium:          'youtube.com',
  'disney+':               'disneyplus.com',
  hulu:                    'hulu.com',
  'u-next':                'unext.jp',
  'abemaぷれみあむ':       'abema.tv',
  dazn:                    'dazn.com',
  'nhkおんでまんど':       'nhk-ondemand.jp',
  'fodぷれみあむ':         'fod.fujitv.co.jp',
  'wowowおんでまんど':     'wowow.co.jp',
  'dあにめすとあ':         'anime.dmkt-sp.jp',
  'ばんだいちゃんねる':    'b-ch.com',
  lemino:                  'lemino.docomo.ne.jp',
  'すかぱー':              'skyperfectv.co.jp',
  'にこにこぷれみあむ':    'nicovideo.jp',

  // 音楽
  spotify:                 'spotify.com',
  applemusic:              'music.apple.com',
  linemusic:               'music.line.me',
  'appletv+':              'tv.apple.com',
  amazonmusicunlimited:    'music.amazon.co.jp',
  awa:                     'awa.fm',
  youtubemusicpremium:     'music.youtube.com',

  // クラウドストレージ
  'icloud+':               'icloud.com',
  googleone:               'one.google.com',
  dropbox:                 'dropbox.com',
  microsoftonedrive:       'onedrive.live.com',

  // ソフトウェア
  chatgptplus:             'openai.com',
  claudepro:               'claude.ai',
  perplexitypro:           'perplexity.ai',
  microsoft365:            'microsoft.com',
  notion:                  'notion.so',
  'ubisoft+':              'ubisoft.com',
  adobecreativecloud:      'adobe.com',
  adobephotoshop:          'adobe.com',
  canvapro:                'canva.com',
  evernote:                'evernote.com',
  githubpro:               'github.com',
  appleone:                'apple.com',
  appledeveloperprogram:   'developer.apple.com',

  // ゲーム
  nintendoswitchonline:    'nintendo.com',
  playstationplus:         'playstation.com',
  xboxgamepassultimate:    'xbox.com',
  eaplay:                  'ea.com',
  applearc:                'apple.com',

  // 電子書籍
  kindleunlimited:         'amazon.co.jp',
  audible:                 'audible.co.jp',

  // 学習
  duolingosuper:           'duolingo.com',
  'すたでぃさぷり':        'studysapuri.jp',
  'すたでぃさぷりいんぐりっしゅ': 'eigosapuri.jp',
  progate:                 'progate.com',
  'どっとインすとーる':    'dotinstall.com',
  'でぃーえむえむえいかいわ': 'eikaiwa.dmm.com',

  // ニュース・雑誌
  newspicks:               'newspicks.com',
  'にほんけいざいしんぶんでんしばん': 'nikkei.com',
  'あさひしんぶんでじたる': 'digital.asahi.com',

  // ショッピング
  'らくてんぷれみあむ':    'rakuten.co.jp',

  // 金融
  'まねーふぉわーどmeぷれみあむ': 'moneyforward.com',
};

/**
 * normalizedName からロゴ画像 URL を返す。
 * 辞書にない場合は null（頭文字フォールバック）。
 */
export function getServiceLogoUrl(normalizedName: string): string | null {
  const domain = SERVICE_LOGO_DOMAINS[normalizedName];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
