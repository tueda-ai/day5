# Gemini API 利用メモ

- 確認日：2026-08-20
- 用途：講義音声まとめWebアプリのMVP

## 1．公式URL

| 内容 | 公式URL |
|---|---|
| Gemini APIドキュメント | [Gemini API documentation](https://ai.google.dev/gemini-api/docs) |
| APIキー作成 | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| APIキーの扱い | [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key) |
| 音声入力 | [Audio understanding](https://ai.google.dev/gemini-api/docs/audio) |
| 生成API | [Interactions API](https://ai.google.dev/api/interactions-api) |
| 構造化出力 | [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) |
| モデル一覧 | [Gemini models](https://ai.google.dev/gemini-api/docs/models) |
| 採用モデル | [Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash) |
| 料金 | [Pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| レート制限 | [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) |

## 2．使用するモデル

`gemini-3.7-flash` を使う．

- Stableモデル．
- 音声入力とテキスト出力に対応．
- 入力上限は1,048,576トークン．
- 出力上限は65,536トークン．

## 3．使用するAPI

### Interactions API

Base64化した音声をインラインで送り，文字起こし，要約，要点を1回で生成する．Files APIは使用しない．

```text
POST https://generativelanguage.googleapis.com/v1beta/interactions
```

リクエストには `store: false` とJSON Schemaの `response_format` を指定する．正常な実行1回につき，Gemini APIリクエストはこの1回だけ発生する．

使用パッケージはGemini公式JavaScript SDKの `@google/genai` とする．

## 4．処理と応答形式

MVPでは無料枠のレート制限にかかりにくくするため，次の処理を1回のInteractions APIリクエストにまとめる．

1. 音声の日本語全文文字起こしを生成する．
2. 文字起こしを元に，3行程度の分量の要約を生成する．
3. 文字起こしを元に，3〜5個の要点を生成する．

要約のプロンプトでは，箇条書き，番号，見出し，改行を使わず，一つの段落だけを返すよう指定する．画面内では次の形で保持する．

```json
{
  "transcript": "文字起こし全文",
  "summary": "3行程度の分量でまとめた一つの文章",
  "keyPoints": ["要点1", "要点2", "要点3"]
}
```

返却された `output_text` をJSONとして解析する．要約に改行が含まれた場合は，画面表示前に空白へ置換して一つの段落に整える．要点は3〜5個の文字列配列であることを確認する．いずれかが欠けている場合は，結果全体をエラーとして扱い，自動再試行は行わない．

## 5．音声の制限

### 対応形式

| 形式 | MIME型 |
|---|---|
| WAV | `audio/wav` |
| MP3 | `audio/mp3` |
| AIFF | `audio/aiff` |
| AAC | `audio/aac` |
| OGG Vorbis | `audio/ogg` |
| FLAC | `audio/flac` |

MP3はブラウザーによって `audio/mpeg` となるため，これも受け付ける．

### MVPの上限

- インライン送信はリクエスト全体で20 MB未満．
- Base64化によるサイズ増加とプロンプトの容量を考慮し，アプリでは音声ファイルを14 MB以下に制限する．
- 想定する約400 KBの講義録音はインライン送信の対象とする．

Files APIへのアップロードと削除は行わない．14 MBを超えるファイルはAPIへ送信せず，画面にエラーを表示する．

## 6．APIキーの注意

- APIキーはGitHubに入れない．
- APIキーはコードに直書きしない．
- MVPでは利用者が入力し，その端末の `localStorage` に保存する．
- `localStorage` は完全に安全な秘密保管場所ではないため，個人利用のMVPに限定する．
- 一般公開する場合は，APIキーをサーバー側の環境変数などで管理する．

## 7．料金とレート制限

- 料金とレート制限はモデルと利用層で変わる．
- 具体的な数値はGoogle AI Studioと公式料金ページで確認する．
- 上限超過時はHTTP 429が返ることがある．
- 1回の実行につき生成リクエストを1回だけ発行し，自動再試行は行わない．
- 無料層と有料層ではデータの取り扱いが異なるため，講義音声を送る前に公式条件を確認する．
