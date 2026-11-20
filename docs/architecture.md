# アーキテクチャ

Urzk Tab Manager 1.0 の設計を図で示します。図は Mermaid で書いており、GitHub 上でそのまま描画されます。

## 1. 全体構成

拡張機能は、タブマネージャーのページと Service Worker の2つのエントリポイントでできています。マネージャーはツールバーボタンか Alt+Shift+T で開き、新しいタブのページは置き換えません。Chrome API には、必ず `ChromeApi` インターフェース経由でアクセスします。そのため、テストやデモでは本物の Chrome をインメモリの `FakeChrome` に差し替えられます。

```mermaid
flowchart LR
  subgraph Chrome["Chrome ブラウザ"]
    CT["chrome.tabs / chrome.windows"]
    CA["chrome.action<br/>(ツールバー / Alt+Shift+T)"]
    FC["_favicon キャッシュ"]
  end

  subgraph SW["Service Worker (background/)"]
    SWE["service-worker.ts<br/>action.onClicked"] --> OM["openManager()<br/>現在のウィンドウの管理タブに切替、なければそこに作成"]
  end

  subgraph NT["タブマネージャーのページ (manager/)"]
    MAIN["main.ts<br/>localizeDocument + mount(App)"] --> APP["App.svelte"]
    APP --> SYNC["TabSync<br/>(lib/state/sync.ts)"]
    APP --> ACT["Actions<br/>(lib/chrome/actions.ts)"]
    SYNC --> EV["subscribeEvents<br/>(lib/chrome/events.ts)"]
    SYNC --> RED["applyEvent<br/>(reducer.ts)"]
    SYNC --> REC["fromSnapshot / reconcile<br/>(reconcile.ts)"]
  end

  API{{"ChromeApi<br/>(lib/chrome/api.ts)"}}

  CA -- クリック --> SWE
  OM --> API
  EV --> API
  SYNC -- "getAll / getCurrent" --> API
  ACT -- "move / remove / discard / update" --> API
  API -. "本番: realChromeApi()" .-> CT
  API -. "テスト / デモ: createFakeChrome()" .-> FAKE["FakeChrome<br/>(mock/fake-chrome.ts)"]
  APP -. "favicon 画像" .-> FC
```

## 2. 状態モデル

`State` は不変（イミュータブル）です。イベントのたびに新しいオブジェクトを作ります。変わっていないタブやウィンドウは同じオブジェクトをそのまま使い回すので、Svelte の keyed リストは変わった部分だけを描き直します。

```mermaid
classDiagram
  class State {
    windowOrder : number[]
    windows : Map~number, WindowLite~
    tabIdsByWindow : Map~number, number[]~
    tabs : Map~number, TabLite~
    currentWindowId? : number
    managerTabId? : number
  }
  class WindowLite {
    id : number
    state? : WindowState
    focused : boolean
  }
  class TabLite {
    id : number
    windowId : number
    title : string
    url : string
    favIconUrl? : string
    discarded : boolean
    active : boolean
    pinned : boolean
    status? : string
  }
  class ChromeEvent {
    <<union>>
    windowCreated / windowRemoved / windowFocusChanged
    tabCreated / tabUpdated / tabMoved
    tabDetached / tabAttached / tabRemoved
    tabReplaced / tabActivated
  }
  class reducer {
    <<module>>
    applyEvent(State, ChromeEvent) State
  }
  class reconcile {
    <<module>>
    fromSnapshot(windows, currentWindowId, managerTabId) State
    reconcile(local, snapshot) state, mismatches
  }
  State "1" o-- "*" WindowLite
  State "1" o-- "*" TabLite
  reducer ..> State : 純粋関数で新しい State を返す
  reducer ..> ChromeEvent
  reconcile ..> State : 内容はスナップショット、同じ値は local のオブジェクトを再利用
```

## 3. モジュールとインターフェース

```mermaid
classDiagram
  direction LR
  class ChromeApi {
    <<interface>>
    windows.getAll / getCurrent / update / remove / create
    windows.onCreated / onRemoved / onFocusChanged
    tabs.query / get / getCurrent / update / move / remove / discard / create
    tabs.onCreated / onUpdated / onMoved / onAttached / onDetached
    tabs.onRemoved / onReplaced / onActivated
  }
  class TabSync {
    <<interface>>
    subscribe(fn) unsubscribe
    start() Promise
    setVisible(boolean)
    reconcileNow() Promise
    stop()
  }
  class Actions {
    <<interface>>
    focusTab / closeTab / discardTab
    moveTab / swapTabs / moveToWindow
    moveToCurrentWindow(id, pinned)
    popOut
    focusWindow / minimizeWindow / closeWindow
  }
  class createTabSync {
    <<factory>>
    debounceMs = 500
    intervalMs = 30000
    MAX_STARTUP_SNAPSHOTS = 3
  }
  class createActions {
    <<factory>>
    失敗しても reject しない（ログのみ）
  }
  class FakeChrome {
    インメモリの Chrome
    ピン留めの領域をまたぐ移動は拒否
    truth()
  }
  class move {
    <<module>>
    moveTarget(index, dir, columns, count, pinnedCount)
  }
  class query {
    <<module>>
    parseQuery(input) Query
    matchesTab(Query, TabLite) boolean
  }
  class favicon {
    <<module>>
    faviconSrc(tab, getURL)
    fallbackFavicon(pageUrl, getURL)
  }
  createTabSync ..|> TabSync
  createActions ..|> Actions
  FakeChrome ..|> ChromeApi
  createTabSync --> ChromeApi
  createActions --> ChromeApi
```

## 4. UI コンポーネント

```mermaid
flowchart TD
  App["App.svelte<br/>state: tabState($state.raw), input, hoveredId<br/>derived: query, current, others"]
  WS["WindowSection.svelte<br/>現在のウィンドウ（展開）+ 他のウィンドウ（開閉）<br/>列数を bind:clientWidth から計算、pinnedCount<br/>FLIP アニメーションは表示200件まで"]
  TC["TabCard.svelte<br/>クリック / Enter で切替、矢印キーで移動"]
  TA["TabActions.svelte<br/>ホバー時のボタン: 破棄・閉じる・切り出し・末尾へ・上下左右"]
  FV["Favicon.svelte<br/>favIconUrl → 失敗時は _favicon"]
  IC["Icon.svelte<br/>FontAwesomeIcon を {#key name} で再生成"]

  App -->|"各ウィンドウ"| WS
  WS -->|"検索に一致するタブ"| TC
  WS --> IC
  TC --> FV
  TC --> TA
  TA --> IC

  App -. "actions を props で渡す" .-> TC
  App -. "setContext('getURL')" .-> FV
  TC -. "moveTarget()" .-> MV["lib/move.ts"]
  TA -. "moveTarget()" .-> MV
  WS -. "matchesTab()" .-> Q["lib/query.ts"]
```

## 5. TabSync の状態遷移

ページが非表示のあいだは「休止」状態になり、イベントの購読もタイマーもすべて外します。休止に入るときや停止するときは `generation` を1つ進めます。こうすることで、途中だった非同期処理の結果は捨てられます。

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> starting : start()（表示中）
  idle --> dormant : start()（非表示）
  starting --> live : スナップショット取得完了
  starting --> dormant : setVisible(false)
  live --> dormant : setVisible(false)
  dormant --> starting : setVisible(true)
  idle --> stopped : stop()
  starting --> stopped : stop()
  live --> stopped : stop()
  dormant --> stopped : stop()
  stopped --> [*]

  state starting {
    [*] --> snapshot
    snapshot --> snapshot : 取得中にイベントが来た（最大3回）
    snapshot --> [*] : イベントなし / 3回目
  }
  state live {
    [*] --> applying
    applying --> applying : イベント → applyEvent → rAF で通知
    applying --> reconciling : 最後のイベントから 500ms / 30s ごと
    reconciling --> applying : reconcile(local, snapshot)
  }
```

## 6. 起動シーケンス

```mermaid
sequenceDiagram
  autonumber
  participant Page as App.svelte
  participant Sync as TabSync
  participant Chrome as ChromeApi

  Page->>Sync: subscribe(fn) → fn(emptyState)
  Page->>Sync: setVisible(document.visibilityState)
  Page->>Sync: start()
  Sync->>Chrome: subscribeEvents()（先に購読）
  Note over Sync: mode = starting<br/>イベントは数えるだけで、適用しない
  loop 最大3回
    Sync->>Chrome: getAll({populate}) / windows.getCurrent / tabs.getCurrent
    Chrome-->>Sync: スナップショット
    Sync->>Sync: state = reconcile(state, snapshot)
    alt 取得中にイベントが来なかった
      Note over Sync: ループを抜ける
    end
  end
  Note over Sync: mode = live<br/>30秒ごとの照合を開始
  Sync-->>Page: fn(state)
```

## 7. 操作と同期の流れ（例: タブを右へ移動）

UI は Chrome の結果を待たずに楽観的に書き換えることはしません。Chrome が発火したイベントを反映して表示を更新します。万一イベントの取りこぼしや競合があっても、照合（reconcile）で Chrome の実際の状態に戻ります。

```mermaid
sequenceDiagram
  autonumber
  actor User as ユーザー
  participant Card as TabCard / TabActions
  participant Act as Actions
  participant Chrome as ChromeApi
  participant Sync as TabSync
  participant Page as App.svelte

  User->>Card: → ボタン / ArrowRight
  Card->>Card: moveTarget(index, "right", columns, count, pinnedCount)
  alt 範囲外、またはピン留めの境界をまたぐ
    Note over Card: ボタンは無効。何もしない
  else 移動できる
    Card->>Act: moveTab(id, to)
    Act->>Chrome: tabs.move(id, {index: to})
    Chrome--)Sync: onMoved イベント
    Sync->>Sync: state = applyEvent(state, tabMoved)
    Sync->>Sync: 照合のデバウンスを 500ms で再設定
    Sync--)Page: requestAnimationFrame で通知（1フレームに1回）
    Page->>Page: tabState = state → 差分だけ描画（200件以下なら FLIP アニメーション）
    Note over Sync: 500ms 後
    Sync->>Chrome: getAll({populate})
    Chrome-->>Sync: スナップショット
    Sync->>Sync: reconcile(local, snapshot)<br/>ずれがあれば修正
    opt 照合中に別のイベントが来た
      Sync->>Sync: もう一度照合を予約
    end
  end
```

## 8. ツールバーボタン / ショートカット

```mermaid
sequenceDiagram
  actor User as ユーザー
  participant SW as Service Worker
  participant Chrome as ChromeApi

  User->>SW: ツールバーボタン / Alt+Shift+T（_execute_action）
  SW->>Chrome: tabs.query({windowId: 押したウィンドウ})
  Chrome-->>SW: そのウィンドウのタブ
  SW->>SW: url / pendingUrl が manager/index.html のタブを探す
  alt 見つかった（複数なら一番左）
    SW->>Chrome: tabs.update(active)
  else 見つからない（ほかのウィンドウにあっても無視）
    SW->>Chrome: tabs.create({url: manager/index.html, windowId})
  end
```

## 9. ビルドとリリース

```mermaid
flowchart LR
  subgraph Local["ローカル"]
    SRC["src/ + public/_locales"] --> VITE["vite build<br/>+ manifestPlugin<br/>（package.json の version を注入）"]
    VITE --> DIST["dist/<br/>manifest.json, manager/, service-worker.js"]
    DIST --> PKG["pnpm package → zip"]
    REL["pnpm release:major|minor|patch<br/>version 更新 + CHANGELOG + コミット + タグ"]
    MOCK["pnpm dev / build:mock<br/>FakeChrome のデモ"] --> SHOT["pnpm screenshots<br/>store/screenshots/*.png"]
  end

  subgraph GH["GitHub Actions"]
    CI["ci.yml（push / PR）<br/>check → lint → test → build → audit"]
    RW["release.yml（v* タグ）<br/>タグと version の一致確認 → test → package<br/>→ GitHub Release に zip を添付"]
  end

  REL -- "git push + タグ" --> RW
  SRC -- "push / PR" --> CI
  RW --> STORE["Chrome Web Store<br/>（zip を手動でアップロード）"]
```
