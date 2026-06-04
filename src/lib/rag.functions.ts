import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const CHAT_MODEL = "google/gemini-2.5-flash";
const REPO = "01-edu/public";
const BRANCH = "master";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    let slice = clean.slice(i, end);
    // try to break on paragraph
    if (end < clean.length) {
      const lastNl = slice.lastIndexOf("\n\n");
      if (lastNl > CHUNK_SIZE / 2) slice = slice.slice(0, lastNl);
    }
    chunks.push(slice.trim());
    i += slice.length - CHUNK_OVERLAP;
    if (slice.length <= CHUNK_OVERLAP) i = end;
  }
  return chunks.filter((c) => c.length > 0);
}

async function embed(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (res.status === 429) throw new Error("Rate limit reached.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function loadReadme(path: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("github_cache")
    .select("content")
    .eq("cache_key", `readme:${path}`)
    .maybeSingle();
  if (data?.content) return data.content;
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/subjects/${path}/README.md`;
  const res = await fetch(url, { headers: { "User-Agent": "lovable-mentor" } });
  if (!res.ok) return "";
  const md = await res.text();
  await supabaseAdmin
    .from("github_cache")
    .upsert({ cache_key: `readme:${path}`, content: md, fetched_at: new Date().toISOString() });
  return md;
}

/** Embed a single subject's README into subject_chunks. Idempotent: deletes existing rows first. */
export const embedSubject = createServerFn({ method: "POST" })
  .inputValidator((d: { subjectPath: string; force?: boolean }) =>
    z.object({ subjectPath: z.string().min(1).max(500), force: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!data.force) {
      const { count } = await supabaseAdmin
        .from("subject_chunks")
        .select("id", { count: "exact", head: true })
        .eq("subject_path", data.subjectPath);
      if ((count ?? 0) > 0) return { skipped: true, chunks: count };
    }

    const md = await loadReadme(data.subjectPath);
    if (!md) return { skipped: true, chunks: 0 };

    const chunks = chunkText(md).slice(0, 30); // cap per subject
    if (!chunks.length) return { skipped: true, chunks: 0 };

    const vectors = await embed(chunks);

    await supabaseAdmin.from("subject_chunks").delete().eq("subject_path", data.subjectPath);
    const rows = chunks.map((content, idx) => ({
      subject_path: data.subjectPath,
      chunk_idx: idx,
      content,
      embedding: vectors[idx] as unknown as string,
    }));
    const { error } = await supabaseAdmin.from("subject_chunks").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, chunks: rows.length };
  });

/** Backfill embeddings for the next N subjects that have no chunks yet. */
export const embedMissingSubjects = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10;

    // Find subjects without chunks
    const { data: rows } = await supabaseAdmin
      .from("subject_meta")
      .select("subject_path")
      .limit(500);
    if (!rows) return { processed: 0 };

    const { data: existing } = await supabaseAdmin
      .from("subject_chunks")
      .select("subject_path");
    const have = new Set((existing ?? []).map((r) => r.subject_path));
    const todo = rows.filter((r) => !have.has(r.subject_path)).slice(0, limit);

    let processed = 0;
    let failed = 0;
    for (const r of todo) {
      try {
        const md = await loadReadme(r.subject_path);
        if (!md) continue;
        const chunks = chunkText(md).slice(0, 30);
        if (!chunks.length) continue;
        const vectors = await embed(chunks);
        const insert = chunks.map((content, idx) => ({
          subject_path: r.subject_path,
          chunk_idx: idx,
          content,
          embedding: vectors[idx] as unknown as string,
        }));
        const { error: insErr } = await supabaseAdmin.from("subject_chunks").insert(insert);
        if (insErr) {
          failed++;
          continue;
        }
        processed++;
      } catch (e) {
        console.error("embed failed", r.subject_path, e);
        failed++;
      }
    }
    return { processed, failed, remaining: Math.max(0, todo.length - processed) };
  });

export const getRagStatus = createServerFn({ method: "GET" }).handler(async () => {
  const [{ count: totalSubjects }, { data: embedded }] = await Promise.all([
    supabaseAdmin.from("subject_meta").select("subject_path", { count: "exact", head: true }),
    supabaseAdmin.from("subject_chunks").select("subject_path"),
  ]);
  const embeddedSet = new Set((embedded ?? []).map((r) => r.subject_path));
  return {
    totalSubjects: totalSubjects ?? 0,
    embeddedSubjects: embeddedSet.size,
    totalChunks: embedded?.length ?? 0,
  };
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

/** Cross-curriculum RAG mentor chat. */
export const ragMentor = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { messages: Array<{ role: "user" | "assistant"; content: string }>; language?: string }) =>
      z
        .object({
          messages: z.array(messageSchema).min(1).max(40),
          language: z.string().max(40).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) throw new Error("No user message");

    // Retrieve relevant chunks
    const [queryVec] = await embed([lastUser.content]);
    const { data: matches, error: rpcErr } = await supabaseAdmin.rpc("match_subject_chunks", {
      query_embedding: queryVec as unknown as string,
      match_count: 8,
      filter_language: data.language ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const context = (matches ?? [])
      .map(
        (m: { subject_path: string; content: string; similarity: number }, i: number) =>
          `[${i + 1}] subjects/${m.subject_path} (sim ${m.similarity.toFixed(2)})\n${m.content}`,
      )
      .join("\n\n---\n\n");

    const sources = (matches ?? []).map((m: { subject_path: string; similarity: number }) => ({
      subject_path: m.subject_path,
      similarity: m.similarity,
    }));

    const system = `You are a senior software engineering mentor for the 01-edu / Learn2Earn curriculum.
You can see retrieved excerpts from project briefs across the whole curriculum below. Use ONLY these excerpts to ground your answer.

RETRIEVED CONTEXT:
---
${context || "(no relevant excerpts found)"}
---

Rules:
- Cite sources inline as [n] referring to the numbered excerpts.
- If the excerpts do not contain the answer, say so plainly — do NOT invent requirements.
- Give hints and pointers, not full solutions. Recommend specific projects when relevant by their subjects/<path>.
- Be warm, concise, markdown-formatted.`;

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });
    if (res.status === 429) throw new Error("Rate limit reached.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return { reply: json.choices[0]?.message?.content ?? "", sources };
  });
