# Urzk Tab Manager — Chrome ウェブストア公開準備 設計書

- 日付: 2026-10-26
- ステータス: レビュー待ち

## 1. 目的と成功基準

自分用に利用中の新規タブ置換型タブ管理拡張を、Chrome ウェブストアで**一般公開**する。

成功基準:

1. `pnpm package`（または tag push による CI）で生成した zip を、そのままストアに提出して審査を通過できる。
2. タブ 1000 枚超の環境で、現行と同じ使い勝手のまま、常駐負荷とメモリ使用量が現行より明確に少ない（計測値で示す）。
3. 表示内容（ウィンドウ一覧・各ウィンドウのタブ一覧・順序）が Chrome の実状態と整合する。不一致が起きても自動で検出・修正される。
4. 既知の脆弱性・不要な権限・外部へのデータ送信がない。
5. UI とストア掲載が英語・日本語に対応している。
6. バージョン番号が単一ソースで管理され、リリース手順が自動化されている。初回は `1.0.0`。

## 2. 決定事項（ブレインストーミングでの合意）

| 項目 | 決定 |
|---|---|
| 公開形態 | 一般公開 |
| 言語 | 英語 + 日本語（`_locales`、ブラウザ UI 言語に追従、`default_locale: en`） |
| 想定規模 | タブ 1000 枚超 |
| メモリ対策 | まず無駄の除去（仮想スクロールなし）→ 計測 → 不足なら仮想スクロールを別途検討 |
| フレームワーク | Svelte 5（runes）+ 最新 Vite へ移行。FontAwesome を廃止しインライン SVG に置換 |
| 名前 | Urzk Tab Manager |
| アイコン | Claude が SVG で作成し、PNG 16/32/48/128 を書き出す |
| バージョン | `package.json` を単一ソースとし、ビルド時に manifest へ注入。semver、初回 `1.0.0` |
| リリース | GitHub Actions で tag push → zip を GitHub Release に添付。ストアへのアップロードは手動 |
| ツールバーアイコン | 既存のマネージャータブがあればフォーカス、なければ開く。ショートカット `Alt+Shift+T` |
| 状態管理 | 案1: ページが chrome イベントを直接購読し差分適用 + 定期的な照合（reconcile） |
| favicon | `tab.favIconUrl` を主に使い、失敗時・空のときは `_favicon` API にフォールバック |
| テスト | vitest（+ fast-check、@testing-library/svelte） |

## 3. 全体構成

### 3.1 ディレクトリ構成

```
public/
  manifest.json            # "version" は持たない。ビルド時に package.json から注入
  _locales/en/messages.json
  _locales/ja/messages.json
  icons/icon-{16,32,48,128}.png
src/
  newtab/                  # 新規タブページ
    index.html
    main.ts
    components/            # App / Window / Tab / TabActions など
  background/
    service-worker.ts      # action / commands 専用
  lib/
    state/                 # model, reducer(applyEvent), snapshot, reconcile, store
    chrome/                # chrome API の薄いアダプタ（イベント購読・操作）
    query.ts               # 検索パーサ + メモリ上フィルタ
    favicon.ts             # favicon URL 決定ロジック
    i18n.ts                # t(key, subs?)
  icons/                   # インライン SVG アイコンコンポーネント
  mock/                    # chrome API モック（dev:mock とテストで共用）
tests/                     # vitest
scripts/                   # package（zip 作成）, release, open-many-tabs
store/                     # ストア掲載文・権限説明・データ使用申告（en/ja）
docs/
PRIVACY.md
CHANGELOG.md
README.md / README.ja.md
```

### 3.2 削除するもの

ルートの `manifest.json`、`tablist.html`、`tablist.js`、`background/background.js`、`public/vite.svg`、`src/assets/svelte.svg`、`@fortawesome/*` の依存。

### 3.3 ビルド

- Vite で 2 エントリ（新規タブページと service worker）をビルドし、`dist/` だけで拡張として完結させる。
- Vite プラグインで `package.json` の `version` を `dist/manifest.json` に注入する。
- `pnpm package` で `release/urzk-tab-manager-<version>.zip` を作成する（`dist/` の中身のみ）。
- `pnpm dev:mock` で chrome API をモックした通常の Web ページとして起動する（UI 確認・スクリーンショット用）。

### 3.4 manifest（主要項目）

- `manifest_version: 3`
- `name` / `description`: `__MSG_extName__` / `__MSG_extDescription__`
- `default_locale: "en"`
- `permissions: ["tabs", "favicon"]`（ホスト権限なし）
- `chrome_url_overrides.newtab`: 新規タブページ
- `action`: `default_title` とアイコン
- `background.service_worker`（`type: "module"`）
- `commands`: `_execute_action` に `suggested_key: Alt+Shift+T`
- `content_security_policy.extension_pages: "script-src 'self'; object-src 'self'"`
- `minimum_chrome_version`: 使用する API（`favicon` 権限 / `_favicon` は Chrome 104+）に合わせて設定
- `icons`: 16/32/48/128

## 4. 状態管理と整合性

### 4.1 モデル

```ts
type TabLite = {
  id: number; windowId: number; index: number;
  title: string; url: string; favIconUrl?: string;
  discarded: boolean; active: boolean; pinned: boolean; status?: string;
};
type WindowLite = { id: number; state: chrome.windows.WindowState; focused: boolean };
type State = {
  windowOrder: number[];                // Chrome の windows.getAll 順
  windows: Map<number, WindowLite>;
  tabIdsByWindow: Map<number, number[]>; // 各ウィンドウの index 順
  tabs: Map<number, TabLite>;
  currentWindowId?: number;
};
```

`chrome.tabs.Tab` を丸ごと保持せず、表示に必要な項目のみを持つ。

### 4.2 イベント適用

- `applyEvent(state, event): State` は chrome 非依存の純粋関数とする。
- 扱うイベント: `windows.onCreated/onRemoved/onFocusChanged`（ウィンドウの `state`（最小化など）は専用イベントがないため、フォーカス変化時の該当ウィンドウ再取得と照合で反映）、`tabs.onCreated/onUpdated/onMoved/onAttached/onDetached/onRemoved/onReplaced/onActivated`。
- 各タブの `index` は `tabIdsByWindow` の位置から再計算する（イベント引数の index は配列操作の位置指定にのみ使う）。
- 同一フレーム内のイベントは `requestAnimationFrame` で 1 回にまとめて反映する。

### 4.3 起動時の競合処理

1. リスナーを登録し、イベントをキューに貯める。
2. `chrome.windows.getAll({ populate: true })` と `chrome.windows.getCurrent()` でスナップショットを取得する。
3. キューのイベントはスナップショットに反映済みか判別できないため適用せず破棄する。1 件でもあれば直ちに再スナップショットする。
4. 以後はイベントを直接適用する。

### 4.4 照合（reconcile）

- トリガー:
  - イベントが連続した後、500ms 静かになったとき（debounce）
  - `visibilitychange` で表示に戻ったとき、ウィンドウにフォーカスが入ったとき
  - 表示中は 30 秒ごと
- `getAll({ populate: true })` の結果と状態を比較する。比較対象はウィンドウ順、各ウィンドウのタブ ID 列、各タブの表示項目。不一致部分だけを置換する。
- キー付き `{#each}` により DOM の再生成は不一致部分のみ。
- 開発ビルドでは不一致件数をコンソールに出し、差分適用ロジックのバグ検出に使う。本番では出さない。

### 4.5 自操作との競合

- 移動・入れ替え・ウィンドウ間移動などの操作は、ローカル状態を先回りで書き換えない。結果は Chrome からのイベントで反映する。
- 入れ替え（2 回の move）の途中で他操作と競合しても、照合で修正される。
- 操作に使う index は最新のローカル状態から計算する。

### 4.6 非表示ページ

- `document.visibilityState === "hidden"` の間はイベント購読と描画を停止する。
- 表示に戻ったときにスナップショットを取り直して同期する。

### 4.7 整合性の保証

- 通常は次フレームで一致する。
- ずれた場合も、操作が止まってから約 0.5 秒、最悪でも 30 秒以内に照合で Chrome の実状態に収束する。

## 5. 描画とメモリ最適化

- タブカードは軽量要素のみ（カード、favicon `<img>`、タイトル、URL）。
- 8 個の操作ボタンは、ホバー中またはフォーカス中のタブ 1 枚にだけ描画する（`TabActions` を 1 枚分）。フェードインは CSS アニメーションで再現する。
- 折りたたみウィンドウの中身は `{#if}` で描画しない。初期状態は現行どおり、現在のウィンドウだけ展開。
- アイコンはインライン SVG コンポーネント。
- 検索は `$derived` によるメモリ上フィルタ。
- flip アニメーションは表示中タブが閾値（初期値 200、計測で調整）以下のときだけ有効。
- `console.log` を削除し、本番ビルドでは debug 出力を除去する。

### 5.1 favicon

- 基本は `tab.favIconUrl` を使い、`onUpdated` で変化を即時反映する（動的 favicon を含め、更新は現行どおり反映）。
- 空のときと読み込み失敗時は `chrome.runtime.getURL("/_favicon/?pageUrl=<url>&size=32")` にフォールバックする。
- 許可するスキームは `http` / `https` / `data` / `chrome`。それ以外は読み込まずフォールバックする。
- `referrerpolicy="no-referrer"`、`loading="lazy"`、`decoding="async"` を付ける。

### 5.2 計測

- `scripts/open-many-tabs` で軽量ページを 1000 枚開く。
- 最適化の前後で次の 3 点を計測し、README の開発者向けセクションに記録する。
  - Chrome タスクマネージャーでのメモリ
  - DOM ノード数
  - 新規タブを開いてから描画完了までの時間
- 結果を見て、仮想スクロールが必要かを判断する（今回のスコープ外）。

### 5.3 ユーザー視点の変更点（合意済み）

- 追加: ツールバーアイコン / ショートカット、日本語 UI、件数の即時表示、favicon がないタブの標準アイコン表示、キーボードフォーカス時のボタン表示。
- 変化: 検索は大文字小文字を区別しない。`site:` はホスト一致で判定する。多数タブ時は flip アニメーションなし。大きな折りたたみウィンドウの展開時に僅かな遅れが出る可能性がある。
- 不変: レイアウト、色、カードサイズ、ボタン配置、キー操作（Enter、矢印キー）。

## 6. 検索

- 文法は現行を維持する。
  - 空白区切りの単語は、タイトルに**この順序で**含まれることを条件にする（現行の `*a*b*` と同等）。大文字小文字は区別しない。
  - `site:<host>`: URL のホストが `<host>` と一致する、または `.<host>` で終わる。判定は `new URL()` でのパースによる。
  - `loaded:` / `l:`: 破棄されていないタブのみ。
- 正規表現や match pattern をユーザー入力から生成しない。
- 検索中は並べ替えボタンを無効にする（現行どおり）。

## 7. Service worker（action / commands）

- `action.onClicked`（ショートカットは `_execute_action` 経由）で、自拡張の新規タブページ URL を開いているタブを `tabs.query` で探す。
  - 見つかったら: そのタブを active にし、ウィンドウにフォーカスする。現在のウィンドウ内のタブを優先する。
  - 見つからなければ: 現在のウィンドウに新規タブとして開く。
- `runtime.onMessage` は使わない。常駐処理はない。

## 8. セキュリティとプライバシー

- 権限は `tabs` と `favicon` のみ。ホスト権限、`storage`、`scripting`、`externally_connectable` は使わない。ストア申請用に権限の利用目的を `store/` に用意する。
- `runtime.onMessage` を廃止し、メッセージの受け口をなくす。
- `{@html}` を使わず、lint（`svelte/no-at-html-tags`）で禁止する。タイトルと URL は常にテキストとして描画する。
- CSP を明示する。リモートコード、`eval`、CDN は使わない。
- 検索入力から正規表現や match pattern を生成しない（ReDoS やパターン注入の防止）。
- chrome API の操作はすべて `await` + `catch` する。失敗は照合で回復する。
- 依存パッケージ: Svelte 5 / 最新 Vite へ更新後、`pnpm audit` で指摘を解消する。CI で `--frozen-lockfile` と `pnpm audit --prod`。Dependabot で週 1 回更新 PR。
- データ: タブ情報は保存・送信・解析しない（メモリ上のみ）。`PRIVACY.md` とストアのデータ使用申告に明記する。favicon は各ページが指定した URL からブラウザ経由で表示する旨も記載する。
- 実装完了後に `/security-review` と superpowers の requesting-code-review でレビューする。

## 9. 多言語化

- `public/_locales/{en,ja}/messages.json` に manifest（名前、説明、ショートカット説明）と UI 文言をすべてまとめる。
- `t(key, subs?)` で `chrome.i18n.getMessage` をラップする。`dev:mock` とテストでは en 辞書を読むモックを使う。
- 対象: 見出し、検索のプレースホルダ、「現在のウィンドウ」、タブ件数（`$COUNT$`）、各ボタンの title、alt テキスト。
- テスト:
  - en と ja のキーが一致していること
  - コード中で使っているキーが辞書にすべて存在すること
- 英語の文言は Claude が整え、日本語は Claude が下訳してユーザーが最終確認する。

## 10. バージョン管理と CI

- バージョンの単一ソースは `package.json` の `version`。
- `pnpm release:{patch,minor,major}`（Node スクリプト、追加依存なし）で次を行う。
  1. `version` を更新する
  2. `CHANGELOG.md` の `## [Unreleased]` を `## [X.Y.Z] - YYYY-MM-DD` に書き換え、新しい `Unreleased` 節を作る
  3. コミットし、tag `vX.Y.Z` を付ける（push は手動）
- `CHANGELOG.md` は Keep a Changelog 形式。
- GitHub Actions:
  - `ci.yml`（PR / main への push）: frozen lockfile でのインストール、`check`、`lint`、`test`、`build`、`pnpm audit --prod`
  - `release.yml`（`v*` tag の push）: tag と `package.json` の version が一致することを確認（不一致なら失敗）→ ビルド → zip → GitHub Release に添付
- 初回リリースは `1.0.0`。

## 11. ストア素材

- アイコン: SVG から PNG 16/32/48/128 を書き出す。
- スクリーンショット: 1280×800、en / ja 各 2〜3 枚。`dev:mock` のダミーデータで撮影する（実際のタブ情報を写さない）。
- プロモーション用小タイル: 440×280 を 1 枚。
- 掲載文: `store/{en,ja}.md` に短い説明、詳しい説明、権限の利用目的、データ使用申告を置く。
- プライバシーポリシー: `PRIVACY.md`。GitHub 上の URL をストアに登録する。
- README: 英語版 `README.md` と日本語版 `README.ja.md`。機能、検索文法、ショートカット、開発手順、計測手順と結果、手動確認チェックリストを載せる。

## 12. テスト

- vitest、superpowers の TDD で実装する。
- 単体テスト:
  - `query`（解析と絞り込み）
  - `applyEvent`（各イベント）
  - `reconcile`（差分の検出と修正）
  - 起動時の競合処理
  - `favicon`（URL の決定とスキーム判定）
  - manifest の生成（version の注入）
  - i18n キーの整合
  - release スクリプトの CHANGELOG 書き換え
- プロパティベーステスト（fast-check）:
  - 偽の Chrome モデルにランダムな操作列（作成、更新、移動、ウィンドウ間の付け替え、削除、置き換え、ウィンドウの作成と削除）を流し、reducer の結果がモデルの真の状態と一致すること
  - 意図的に欠落させたイベント列でも、照合後は必ず一致すること
- コンポーネントテスト（`@testing-library/svelte` + jsdom + chrome モック）:
  - ホバー時にだけ操作ボタンが描画される
  - 折りたたみウィンドウは描画されない
  - クリックやキー操作で正しい chrome API が呼ばれる
  - 検索中は並べ替えボタンが無効になる
- 手動確認（README のチェックリスト）:
  - `dist/` を実際の Chrome で読み込む
  - 1000 タブで計測する
  - ショートカットとツールバーアイコンの動作
  - en / ja の表示
  - ウィンドウ間のタブ移動、最小化、閉じる
- スコープ外: 実際の Chrome を自動操作する E2E テスト（Playwright など）。

## 13. スコープ外

- 仮想スクロール（計測結果次第で別 spec）
- Chrome Web Store API によるアップロード自動化
- ポップアップ UI、設定画面、アプリ内の言語切替
- 複数の新規タブ間での状態共有
