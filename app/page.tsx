"use client";

import { GoogleGenAI } from "@google/genai";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "lecture-note.gemini-api-key";
const MODEL = "gemini-3.7-flash";
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const MIME_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

type ProcessingStage = "idle" | "uploading" | "transcribing" | "summarizing" | "extracting";

function getAudioMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "";
}

function parseKeyPoints(text: string) {
  const cleanPoint = (point: string) => point
    .replace(/^\s*(?:[-*・•]|\d+[.)．\u3001])\s*/, "")
    .trim();
  const lines = text.split(/\r?\n/).map(cleanPoint).filter(Boolean);

  if (lines.length >= 3) return lines.slice(0, 5);

  return text
    .split(/(?<=[\u3002\uff01\uff1f])\s*/)
    .map(cleanPoint)
    .filter(Boolean)
    .slice(0, 5);
}

function getApiErrorMessage(error: unknown, action: "文字起こし" | "要約" | "要点") {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 401 || status === 403 || /api[_ -]?key|API_KEY_INVALID/i.test(message)) {
    return "APIキーを確認してください．";
  }
  if (status === 400) {
    return `${action}のリクエストを処理できませんでした．入力内容を確認して再度実行してください．`;
  }
  if (status === 429) {
    return "Gemini APIの利用上限に達しました．時間を置いて再度実行してください．";
  }
  if (status && status >= 500) {
    return "Gemini APIが一時的に応答できません．少し待って再度実行してください．";
  }
  return `${action}に失敗しました．通信状況とAPIキーを確認してください．`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [lectureName, setLectureName] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [keyPointsError, setKeyPointsError] = useState("");
  const [copied, setCopied] = useState("");
  const isProcessing = processingStage !== "idle";

  useEffect(() => {
    const storedKey = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setApiKey(storedKey);
    setKeyDraft(storedKey);
  }, []);

  useEffect(() => {
    if (!keyDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setKeyDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [keyDialogOpen]);

  const openKeyDialog = () => {
    setKeyDraft(apiKey);
    setKeyDialogOpen(true);
  };

  const saveKey = (event: FormEvent) => {
    event.preventDefault();
    const nextKey = keyDraft.trim();
    if (!nextKey) return;
    window.localStorage.setItem(STORAGE_KEY, nextKey);
    setApiKey(nextKey);
    setKeyDialogOpen(false);
    setError("");
  };

  const removeKey = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setApiKey("");
    setKeyDraft("");
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    setAudioFile(event.target.files?.[0] ?? null);
    setError("");
    setTranscript("");
    setSummary("");
    setSummaryError("");
    setKeyPoints([]);
    setKeyPointsError("");
  };

  const runTranscription = async (event: FormEvent) => {
    event.preventDefault();
    if (!apiKey) {
      setError("APIキーを設定してください．");
      setKeyDialogOpen(true);
      return;
    }
    if (!lectureName.trim()) {
      setError("講義名を入力してください．");
      return;
    }
    if (!audioFile) {
      setError("音声ファイルを選択してください．");
      return;
    }
    const mimeType = getAudioMimeType(audioFile);
    if (!mimeType) {
      setError("対応している音声ファイルを選択してください．");
      return;
    }
    if (audioFile.size > MAX_FILE_SIZE) {
      setError("ファイルサイズが2 GBを超えています．");
      return;
    }

    setError("");
    setTranscript("");
    setSummary("");
    setSummaryError("");
    setKeyPoints([]);
    setKeyPointsError("");
    setProcessingStage("uploading");

    const client = new GoogleGenAI({ apiKey });
    let uploadedFileName: string | undefined;

    try {
      const uploadedFile = await client.files.upload({
        file: audioFile,
        config: { mimeType },
      });
      uploadedFileName = uploadedFile.name;

      if (!uploadedFile.uri || !uploadedFile.mimeType) {
        throw new Error("Uploaded file metadata is incomplete");
      }

      setProcessingStage("transcribing");
      const interaction = await client.interactions.create({
        model: MODEL,
        store: false,
        input: [
          {
            type: "text",
            text: `講義名：${lectureName.trim()}\nこの音声内の発言を，聞き取れる範囲で省略せず日本語で全文文字起こししてください．要約，要点，解説，前置き，Markdownは付けず，文字起こし本文だけを出力してください．聞き取れない箇所は [聞き取れず] と記載してください．`,
          },
          {
            type: "audio",
            uri: uploadedFile.uri,
            mime_type: uploadedFile.mimeType,
          },
        ],
      });

      const generatedTranscript = interaction.output_text?.trim() ?? "";
      if (!generatedTranscript) {
        throw new Error("Transcript is empty");
      }

      setTranscript(generatedTranscript);
      window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 60);

      setProcessingStage("summarizing");
      try {
        const summaryInteraction = await client.interactions.create({
          model: MODEL,
          store: false,
          input: `講義名：${lectureName.trim()}\n以下の文字起こしを，重要な内容が分かる3行程度の分量で要約してください．箇条書き，番号，見出し，改行は使わず，120〜180文字程度の一つの段落だけを出力してください．\n\n文字起こし：\n${generatedTranscript}`,
        });

        const generatedSummary = (summaryInteraction.output_text ?? "")
          .replace(/\s*\n+\s*/g, " ")
          .replace(/[ \t]{2,}/g, " ")
          .trim();
        if (!generatedSummary) {
          throw new Error("Summary is empty");
        }
        setSummary(generatedSummary);
      } catch (summaryApiError) {
        setSummaryError(getApiErrorMessage(summaryApiError, "要約"));
      }

      setProcessingStage("extracting");
      try {
        const keyPointsInteraction = await client.interactions.create({
          model: MODEL,
          store: false,
          input: `講義名：${lectureName.trim()}\n以下の文字起こしから，復習時に重要な要点を3〜5個抽出してください．各要点は，それだけで内容が分かる簡潔な日本語の一文にしてください．要点ごとに改行し，各行の先頭に「- 」を付けてください．見出し，前置き，補足は出力しないでください．\n\n文字起こし：\n${generatedTranscript}`,
        });

        const generatedKeyPoints = parseKeyPoints(keyPointsInteraction.output_text ?? "");
        if (generatedKeyPoints.length < 3) {
          throw new Error("Key points are incomplete");
        }
        setKeyPoints(generatedKeyPoints);
      } catch (keyPointsApiError) {
        setKeyPointsError(getApiErrorMessage(keyPointsApiError, "要点"));
      }
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "文字起こし"));
    } finally {
      if (uploadedFileName) {
        try {
          await client.files.delete({ name: uploadedFileName });
        } catch {
          // Files APIのファイルは48時間後に自動削除される．
        }
      }
      setProcessingStage("idle");
    }
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("コピーできませんでした");
    }
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lecture Note トップへ">
          <span className="brand-mark" aria-hidden="true">LN</span>
          <span><strong>Lecture Note</strong><small>Audio to study notes</small></span>
        </a>
        <button className="key-button" type="button" onClick={openKeyDialog}>
          <span className={`status-dot ${apiKey ? "is-ready" : ""}`} aria-hidden="true" />APIキー設定
        </button>
      </header>

      <div className="content" id="top">
        <section className="hero" aria-labelledby="page-title">
          <div className="eyebrow-row"><span className="eyebrow">Lecture companion</span><span className="prototype-badge">MVP BETA</span></div>
          <h1 id="page-title">聴く時間を，<br /><em>復習する時間</em>へ．</h1>
          <p>講義音声を選ぶだけで，文字起こしと学習の要点をひとつのノートに整理します．</p>
        </section>

        <section className="workspace" aria-label="講義音声の入力">
          <form className="upload-card" onSubmit={runTranscription}>
            <div className="section-heading"><span>01</span><div><p>NEW NOTE</p><h2>音声からノートを作る</h2></div></div>
            <div className="key-status-row">
              <span className={`status-dot ${apiKey ? "is-ready" : ""}`} aria-hidden="true" />
              <span>{apiKey ? "APIキー設定済み" : "APIキー未設定"}</span>
              <button type="button" onClick={openKeyDialog}>{apiKey ? "変更" : "設定する"}</button>
            </div>
            <label className="field-label" htmlFor="lecture-name">講義名</label>
            <input className="text-input" id="lecture-name" maxLength={100} onChange={(event) => { setLectureName(event.target.value); setError(""); setTranscript(""); setSummary(""); setSummaryError(""); setKeyPoints([]); setKeyPointsError(""); }} placeholder="例：情報システム基礎 第5回" type="text" value={lectureName} />
            <span className="field-label">音声ファイル</span>
            <input className="visually-hidden" id="audio-file" type="file" accept=".wav,.mp3,.aiff,.aif,.aac,.ogg,.flac,audio/wav,audio/mp3,audio/mpeg,audio/aiff,audio/aac,audio/ogg,audio/flac" onChange={selectFile} />
            <label className={`file-picker ${audioFile ? "has-file" : ""}`} htmlFor="audio-file">
              <span className="file-icon" aria-hidden="true"><i /><i /><i /><i /></span>
              {audioFile ? <span className="file-copy"><strong>{audioFile.name}</strong><small>{formatBytes(audioFile.size)} ・ 選択済み</small></span> : <span className="file-copy"><strong>タップして音声を選択</strong><small>WAV，MP3，AAC，OGG，FLAC など</small></span>}
              <span className="select-label">{audioFile ? "変更" : "選択"}</span>
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="run-button" type="submit" disabled={isProcessing}>
              {isProcessing ? <><span className="spinner" aria-hidden="true" />{processingStage === "uploading" ? "音声をアップロード中…" : processingStage === "transcribing" ? "文字起こし中…" : processingStage === "summarizing" ? "要約を生成中…" : "要点を抽出中…"}</> : <><span>学習ノートを作成</span><b aria-hidden="true">→</b></>}
            </button>
            <p className="demo-note">文字起こし，要約，要点を自動生成します．音声ファイルはGemini APIへ送信されます．</p>
          </form>

          <aside className="guide-card">
            <div className="guide-kicker">HOW IT WORKS</div><h2>3ステップで<br />復習の準備完了</h2>
            <ol>
              <li><span>1</span><div><strong>講義名を入力</strong><small>後から見ても分かる名前にします．</small></div></li>
              <li><span>2</span><div><strong>音声を選択</strong><small>スマホに保存したファイルを使えます．</small></div></li>
              <li><span>3</span><div><strong>実行してコピー</strong><small>文字起こし，要約，要点をそれぞれコピーできます．</small></div></li>
            </ol>
            <div className="format-note"><span>SUPPORTED</span><p>WAV / MP3 / AIFF / AAC / OGG / FLAC</p></div>
          </aside>
        </section>

        <section className="results-section" id="results" aria-labelledby="results-title">
          <div className="results-heading">
            <div><span className="section-number">02</span><p>STUDY NOTE</p><h2 id="results-title">{lectureName.trim() || "生成したノート"}</h2></div>
            {transcript && <span className="complete-badge">{keyPoints.length ? "ノート作成完了" : summary ? "要約まで完了" : "文字起こし完了"}</span>}
          </div>
          {!transcript ? (
            <div className="empty-result"><span aria-hidden="true">A</span><div><h3>文字起こしはここに表示されます</h3><p>講義名と音声ファイルを入力し，実行ボタンを押してください．</p></div></div>
          ) : (
            <div className="result-grid">
              <article className="result-card transcript-card">
                <div className="result-card-head"><div><span>FULL TEXT</span><h3>文字起こし</h3></div><button type="button" onClick={() => copyText("文字起こし", transcript)}>コピー</button></div>
                <p className="transcript-text">{transcript}</p>
              </article>
              {(summary || summaryError || processingStage === "summarizing") && (
                <article className="result-card summary-card" aria-live="polite">
                  <div className="result-card-head">
                    <div><span>SUMMARY</span><h3>要約</h3></div>
                    {summary && <button type="button" onClick={() => copyText("要約", summary)}>コピー</button>}
                  </div>
                  {summary ? (
                    <p className="summary-text">{summary}</p>
                  ) : summaryError ? (
                    <p className="summary-error" role="alert">{summaryError}</p>
                  ) : (
                    <p className="summary-loading"><span className="inline-spinner" aria-hidden="true" />要約を生成しています…</p>
                  )}
                </article>
              )}
              {(keyPoints.length > 0 || keyPointsError || processingStage === "extracting") && (
                <article className="result-card points-card" aria-live="polite">
                  <div className="result-card-head">
                    <div><span>KEY POINTS</span><h3>要点</h3></div>
                    {keyPoints.length > 0 && <button type="button" onClick={() => copyText("要点", keyPoints.map((point) => `・${point}`).join("\n"))}>コピー</button>}
                  </div>
                  {keyPoints.length > 0 ? (
                    <ul className="points-list">
                      {keyPoints.map((point, index) => <li key={`${index}-${point}`}><span aria-hidden="true" /><div>{point}</div></li>)}
                    </ul>
                  ) : keyPointsError ? (
                    <p className="summary-error" role="alert">{keyPointsError}</p>
                  ) : (
                    <p className="summary-loading"><span className="inline-spinner" aria-hidden="true" />要点を抽出しています…</p>
                  )}
                </article>
              )}
            </div>
          )}
        </section>
      </div>

      <footer><span>Lecture Note</span><p>録音データの取り扱いには十分注意してください．</p></footer>

      {keyDialogOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setKeyDialogOpen(false); }}>
          <section className="key-modal" role="dialog" aria-modal="true" aria-labelledby="key-title">
            <button className="modal-close" type="button" onClick={() => setKeyDialogOpen(false)} aria-label="閉じる">×</button>
            <span className="modal-number">API KEY</span><h2 id="key-title">Gemini APIキーの設定</h2>
            <p>キーはこの端末のブラウザー内にだけ保存されます．共有端末では使用しないでください．</p>
            <form onSubmit={saveKey}>
              <label htmlFor="api-key">APIキー</label>
              <input autoFocus id="api-key" type="password" value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder="Gemini APIキーを入力" />
              <button className="save-key-button" type="submit" disabled={!keyDraft.trim()}>この端末に保存</button>
              {apiKey && <button className="remove-key-button" type="button" onClick={removeKey}>APIキーを削除</button>}
            </form>
          </section>
        </div>
      )}
      <div className={`toast ${copied ? "is-visible" : ""}`} role="status" aria-live="polite">{copied === "コピーできませんでした" ? copied : copied ? `${copied}をコピーしました` : ""}</div>
    </main>
  );
}
