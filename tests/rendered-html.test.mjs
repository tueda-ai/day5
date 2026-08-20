import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Lecture Note application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Lecture Note \| 講義音声を学習ノートに<\/title>/i);
  assert.match(html, /学習ノートを作成/);
  assert.match(html, /APIキー設定/);
  assert.match(html, /文字起こしはここに表示されます/);
});

test("uses one inline Gemini request for the complete note", async () => {
  const [page, apiNotes] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../API_NOTES.md", import.meta.url), "utf8"),
  ]);

  assert.equal(page.match(/client\.interactions\.create/g)?.length, 1);
  assert.doesNotMatch(page, /client\.files\./);
  assert.match(page, /fileToBase64/);
  assert.match(page, /data:\s*audioData/);
  assert.match(page, /response_format:\s*\{/);
  assert.match(page, /required:\s*\["transcript", "summary", "keyPoints"\]/);
  assert.match(page, /const MAX_FILE_SIZE = 14 \* 1024 \* 1024/);
  assert.match(apiNotes, /正常な実行1回につき，Gemini APIリクエストはこの1回だけ発生する/);
});
