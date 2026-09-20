# 凪プレイヤー

iPhone 向けの、同梱 MP3／MP4 専用メディアプレイヤーです。Expo Router を使わない単一画面の TypeScript Expo アプリで、MP3 はバックグラウンド・ロック画面操作、MP4 はインライン再生と Picture in Picture（PiP）に対応します。

## 素材の登録

正式な利用許諾済み素材を次へ配置します。

- `assets/media/` — MP3 / MP4
- `assets/artwork/` — 項目ごとの PNG / JPG

素材のファイル名・登録は [src/mediaAssets.ts](src/mediaAssets.ts) に集約しています。ここで静的な `require()` に置き換え、表示情報は [src/playlist.ts](src/playlist.ts) で編集してください。現時点では素材が未提供のため、再生操作は登録方法を知らせる案内を表示します。

配布するすべての音声、映像、アートワークについて、アプリへの同梱・配布に必要な利用許諾を確認してください。

## ローカル起動

```powershell
npm install
npm run typecheck
npx expo start --dev-client
```

## iPhone development build

バックグラウンド音声、ロック画面コントロール、PiP は Expo Go では検証できません。`app.json` の config plugin と `UIBackgroundModes: ["audio"]` は development build に反映されます。

1. Apple Developer の署名環境、EAS を使える Expo アカウント、実機 iPhone を準備します。
2. Expo にログインします: `npx eas login`
3. 初回だけプロジェクトを設定します: `npx eas build:configure`
4. iOS development build を作成します: `npx eas build --profile development --platform ios`
5. EAS が案内する URL で iPhone に build をインストールします。
6. `npx expo start --dev-client` を実行して、インストール済みの development build から開きます。

`eas.json` の `development` プロファイルは internal distribution と development client を有効にしています。`ios.bundleIdentifier` の `com.example.nagiplayer` は、署名用に自組織の一意な識別子へ変更してください。

## 実機確認項目

- MP3: 消音モード、画面ロック、バックグラウンド継続、ロック画面／コントロールセンターからの操作。
- MP4: インライン再生、PiP 開始ボタン、アプリを離れた際の自動 PiP、復帰後の時間と再生状態。
- MP3 と MP4 を連続選択し、同時再生がないこと、前後スキップ・シーク・末尾停止・次項目自動再生を確認。
