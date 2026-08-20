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
| ファイルアップロード | [Files API](https://ai.google.dev/gemini-api/docs/files) |
| 生成API | [Interactions API](https://ai.google.dev/api/interactions-api) |
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

### Files API

音声ファイルをアップロードする．

```text
POST https://generativelanguage.googleapis.com/upload/v1beta/files
```

### Interactions API

アップロードした音声から文字起こしを生成し，続く別のリクエストで文字起こし本文から要約と要点をそれぞれ生成する．

```text
POST https://generativelanguage.googleapis.com/v1beta/interactions
```

リクエストには `store: false` を指定する．

使用パッケージはGemini公式JavaScript SDKの `@google/genai` とする．

## 4．処理と応答形式

MVPでは処理結果を確認しやすくするため，次のように分ける．

1. 音声を入力して，文字起こし本文だけをテキストで取得する．
2. 文字起こし本文を入力して，3行程度の分量の要約だけをテキストで取得する．
3. 文字起こし本文を入力して，3〜5個の要点を1行ずつのテキストで取得する．

要約のプロンプトでは，箇条書き，番号，見出し，改行を使わず，一つの段落だけを返すよう指定する．画面内では次の形で保持する．

```json
{
  "transcript": "文字起こし全文",
  "summary": "3行程度の分量でまとめた一つの文章",
  "keyPoints": ["要点1", "要点2", "要点3"]
}
```

各Interactions APIリクエストは `store: false` とし，返却された `output_text` を使用する．要約に改行が含まれた場合は，画面表示前に空白へ置換して一つの段落に整える．要点は改行で分割し，先頭の箇条書き記号を取り除いて3〜5個の文字列配列として保持する．

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

### 主な上限

- Files APIは1ファイル最大2 GB．
- Files APIは1プロジェクト最大20 GB．
- アップロードしたファイルは48時間後に自動削除される．
- 音声は1プロンプト最大9.5時間．
- インライン送信はリクエスト全体で20 MB未満．

MVPではサイズにかかわらずFiles APIを使い，処理を分岐させない．

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
- 無料層と有料層ではデータの取り扱いが異なるため，講義音声を送る前に公式条件を確認する．
