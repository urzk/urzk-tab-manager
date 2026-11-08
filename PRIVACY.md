# Privacy Policy / プライバシーポリシー

[English](#english) | [日本語](#日本語)

## English

Last updated: 2026-11-08

This policy covers the Urzk Tab Manager extension for Google Chrome.

### Summary

Urzk Tab Manager reads information about your open tabs (including their
titles and URLs) only to show and manage them on the new tab page. This
information stays in memory on your device. It is never saved, and never sent
to the developer or to any third party.

### What the extension accesses

- **Tab and window information.** Using the `tabs` permission, the extension
  reads the titles, URLs, favicon URLs and states (for example, loaded or
  discarded) of your open tabs and windows. It uses this information only to
  show the tab list on the new tab page and to carry out the actions you choose
  (switch to, move, discard or close a tab or window).
- **Cached favicons.** Using the `favicon` permission, the extension shows the
  favicons that Chrome has already cached, when a page's own icon is
  unavailable.

### How the information is handled

- Tab information is processed in memory only, while the new tab page is open.
  It is discarded when the page is closed.
- The extension does not use any storage API, and does not save tab
  information to disk, to sync storage or anywhere else.
- The extension does not send tab information, or any other data, to the
  developer or to any third party. The only network activity is loading
  favicon images, described below.
- There are no analytics, tracking, advertising, accounts or remote code.

### Chrome Web Store User Data Policy

The use of information received from Google APIs will adhere to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies),
including the Limited Use requirements. In particular, tab information is used
only to provide the extension's single purpose described above; it is not sold,
not transferred to third parties, not used for advertising, not used to
determine creditworthiness or for lending purposes, and not read by humans.

### Favicons

To display a tab's favicon, the browser loads the image from the URL that the
open page itself specified, with the `no-referrer` policy, so the address of
the new tab page is not sent with the request. If that URL is missing, uses an
unsupported scheme or fails to load, the icon is taken from Chrome's internal
favicon cache instead, which involves no network request. These images are
loaded only to be displayed.

### Changes to this policy

If this policy changes, the updated version will be published at
https://github.com/urzk/urzk-tab-manager/blob/main/PRIVACY.md with a new
"Last updated" date.

### Contact

Please ask questions or report issues at
https://github.com/urzk/urzk-tab-manager/issues.

## 日本語

最終更新日: 2026-11-08

このポリシーは、Google Chrome 用拡張機能 Urzk Tab Manager に適用されます。

### 概要

Urzk Tab Manager は、開いているタブの情報（タイトルや URL を含む）を、新しいタブのページで一覧表示・管理するためだけに読み取ります。これらの情報はお使いの端末のメモリ上でのみ扱い、保存することも、開発者や第三者に送信することもありません。

### 拡張機能がアクセスする情報

- **タブとウィンドウの情報。** `tabs` 権限により、開いているタブとウィンドウのタイトル、URL、ファビコンの URL、状態（読み込み済みか破棄済みかなど）を読み取ります。これらの情報は、新しいタブのページにタブの一覧を表示することと、ユーザーが選んだ操作（タブやウィンドウへの切り替え、移動、破棄、閉じる）を行うことにのみ使います。
- **キャッシュ済みのファビコン。** `favicon` 権限により、ページ自身のアイコンを取得できないときに、Chrome がすでにキャッシュしているファビコンを表示します。

### 情報の取り扱い

- タブの情報は、新しいタブのページを開いている間、メモリ上でのみ処理します。ページを閉じると破棄されます。
- ストレージ API は使用せず、タブの情報をディスクや同期ストレージなどに保存しません。
- タブの情報やその他のデータを、開発者や第三者に送信しません。ネットワーク通信は、下記のファビコン画像の読み込みのみです。
- アクセス解析、トラッキング、広告、アカウント、リモートコードはありません。

### Chrome ウェブストアのユーザーデータに関するポリシー

Google API から受け取った情報の使用は、Limited Use（使用制限）の要件を含む [Chrome ウェブストアのユーザーデータに関するポリシー](https://developer.chrome.com/docs/webstore/program-policies/policies) に従います。特に、タブの情報は上記の単一の用途を提供するためにのみ使用し、販売、第三者への転送、広告への利用、信用力の判断や融資目的での利用は行わず、人が閲覧することもありません。

### ファビコン

タブのファビコンを表示するため、ブラウザは開いているページ自身が指定した URL から画像を読み込みます。その際 `no-referrer` ポリシーを指定するため、新しいタブのページのアドレスはリクエストに含まれません。URL がない場合、対応していないスキームの場合、または読み込みに失敗した場合は、代わりに Chrome 内部のファビコンキャッシュを使います。こちらはネットワーク通信を伴いません。これらの画像は表示のためにのみ読み込みます。

### ポリシーの変更

このポリシーを変更する場合は、https://github.com/urzk/urzk-tab-manager/blob/main/PRIVACY.md に新しい最終更新日とともに掲載します。

### お問い合わせ

ご質問や問題の報告は https://github.com/urzk/urzk-tab-manager/issues までお寄せください。
