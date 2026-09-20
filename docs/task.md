# 凪プレイヤー 実装タスク

## 目的

利用許諾済みの音声・動画をアプリに同梱し、ブラウザで再生できる日本語UIのWeb PWAを提供する。GitHub Pagesで公開し、iPhoneではSafariからホーム画面へ追加して利用できるようにする。

## 対象範囲

- 固定プレイリストに同梱した MP3 / MP4 の再生
- 再生対象の選択、再生／一時停止、前後移動、シーク、再生時間表示
- 現在のメディアのタイトル、アーティスト、種別、アートワーク表示
- 動画のインライン再生と、対応ブラウザでの Picture in Picture（PiP）
- Media Session 対応ブラウザでの再生状態・メタデータ連携
- Service Worker によるアプリシェルと同梱メディアのオフライン利用
- GitHub ActionsからGitHub Pagesへの公開

## 対象外

- ネイティブiOS／Androidアプリのビルド・配布
- Expo development build、EAS、ネイティブのバックグラウンド再生設定
- ファイルアプリからのメディア選択
- URLストリーミング
- 再生リストの編集、再生履歴、お気に入り、アカウント機能

## 実装方針

- ExpoのWeb出力を使用し、単一画面のTypeScriptアプリとして実装する。
- `src/mediaAssets.ts` に同梱アセットの登録、`src/playlist.ts` に表示用メタデータを置き、UI実装から分離する。
- 音声は `expo-audio`、動画は `expo-video` で再生する。曲・動画を切り替える際は、既存プレイヤーを停止して二重再生を防ぐ。
- `public/manifest.json` と `workbox-config.js` でPWAのマニフェストとオフラインキャッシュを管理する。
- 公開先のベースパスはGitHub Pages用の `/nagi-player` とする。

## 完了条件

- `npm run typecheck` が成功する。
- `npm run build:web` が成功し、`dist/` にPWA成果物とService Workerが出力される。
- 再生リスト選択、再生／一時停止、シーク、前後移動、再生終了後の次項目遷移が動作する。
- 音声と動画を続けて切り替えても同時再生しない。
- 対応ブラウザではMedia SessionおよびPiPを利用でき、非対応環境でも通常再生ができる。
- 初回のオンライン利用後、同梱メディアを含めてオフライン再生できる。
- `main` へのpushでGitHub Actionsが型検査、Webビルド、GitHub Pagesへの公開を実行する。

## 素材追加時の確認事項

- MP3またはH.264映像／AAC音声のMP4と、対応するアートワークを `assets/` に追加する。
- `src/mediaAssets.ts` と `src/playlist.ts` を更新する。
- 素材を同梱・配布する利用許諾を確認する。
- 追加後にWebビルドと実機ブラウザでの再生を確認する。

## ブラウザ上の制約

バックグラウンド再生、ロック画面操作、Media Session、PiPの可否や動作範囲は、ブラウザとOSの対応状況に依存する。これらはネイティブアプリと同等の動作を保証しない。
