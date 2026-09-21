# 凪プレイヤー

同梱した音声・動画をブラウザで再生するWeb専用PWAです。公開版は [GitHub Pages](https://ApplePie3939.github.io/nagi-player/) で利用できます。iPhoneではSafariで開き、共有メニューの「ホーム画面に追加」を選ぶとアプリのように起動できます。

## 素材の登録

利用許諾済みの素材を次へ配置します。

- `assets/media/` — 音声は MP3、動画は H.264 映像／AAC 音声の MP4
- `assets/artwork/` — 項目ごとの PNG / JPG

ファイル名と再生リストへの登録は [src/mediaAssets.ts](src/mediaAssets.ts) と [src/playlist.ts](src/playlist.ts) に集約しています。Vite がこれらを公開用アセットとして出力します。素材を同梱・配布する許諾を確認してからコミットしてください。

## 開発と公開

```powershell
npm install
npm run typecheck
npm run web
```

開発サーバーは Vite で起動します。production成果物を作るには `npm run build:web` を実行します。`dist/` をローカルで確認するには `npm run serve:web` を実行してください。`main` へのpush時にはGitHub Actionsが型検査、Webビルド、GitHub Pages公開を実行します。初回のみリポジトリの **Settings → Pages → Build and deployment** でソースを **GitHub Actions** に設定してください。

## オフラインとブラウザ機能

初回のオンライン利用後、PWAはアプリシェルと同梱メディアをキャッシュするため、オフラインでも再生できます。更新版を利用するには、ネットワーク接続時にPWAを開き直してください。

再生情報、再生／一時停止、シークは対応ブラウザのMedia Sessionと連携します。バックグラウンド再生、ロック画面の操作、動画のPicture in Pictureは、ブラウザとOSが対応する範囲でのみ利用できます。PiPの非対応環境では開始ボタンは表示されません。
