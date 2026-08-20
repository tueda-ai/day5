# Lecture Note

講義や自習の音声から，Gemini APIで次の内容を作るスマートフォン対応Webアプリです．

- 文字起こし全文
- 3行程度の一つの文章による要約
- 3〜5個の要点

## 必要なもの

- Node.js 22.13.0以上
- Gemini APIキー
- 14 MB以下のWAV，MP3，AIFF，AAC，OGG，FLAC音声ファイル

APIキーは[Google AI Studio](https://aistudio.google.com/app/apikey)で作成できます．

## セットアップ

プロジェクトフォルダで次を実行します．

```bash
npm install
npm run dev
```

ブラウザーで [http://localhost:3000](http://localhost:3000) を開きます．

## 使い方

1. 「APIキー設定」を押し，Gemini APIキーを保存する．
2. 講義名を入力する．
3. 音声ファイルを選択する．
4. 「学習ノートを作成」を押す．
5. 表示された文字起こし，要約，要点を必要に応じてコピーする．

## 動作確認

```bash
npm run build
```

手動テストは [TESTCASES.md](./TESTCASES.md) を参照してください．

## 注意

- APIキーはブラウザーの `localStorage` に保存され，ソースコードには保存されません．
- 音声ファイルは処理のためGemini APIへ送信されます．
- 文字起こし，要約，要点は1回のGemini APIリクエストでまとめて生成されます．
- API利用量に応じて料金や利用制限が発生する場合があります．
- 詳細仕様は [SPEC.md](./SPEC.md)，API情報は [API_NOTES.md](./API_NOTES.md) を参照してください．
