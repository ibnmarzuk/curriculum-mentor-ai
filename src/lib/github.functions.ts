import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REPO = "01-edu/public";
const BRANCH = "master";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function getCached(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("github_cache")
    .select("content, fetched_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return data.content;
}

async function setCached(key: string, content: string) {
  await supabaseAdmin
    .from("github_cache")
    .upsert({ cache_key: key, content, fetched_at: new Date().toISOString() });
}

export type TreeEntry = { name: string; path: string; type: "dir" | "file" };

export const listSubjects = createServerFn({ method: "GET" })
  .inputValidator((d: { path?: string }) => ({ path: (d.path ?? "").replace(/^\/+|\/+$/g, "") }))
  .handler(async ({ data }): Promise<TreeEntry[]> => {
    const subPath = data.path ? `/${data.path}` : "";
    const cacheKey = `tree:${data.path}`;
    const cached = await getCached(cacheKey);
    if (cached) return JSON.parse(cached);

    const url = `https://api.github.com/repos/${REPO}/contents/subjects${subPath}?ref=${BRANCH}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "lovable-mentor" },
    });
    if (!res.ok) {
      console.error("GitHub list failed", res.status, await res.text());
      return [];
    }
    const json = (await res.json()) as Array<{ name: string; path: string; type: string }>;
    const entries: TreeEntry[] = json
      .filter((e) => e.type === "dir" || e.type === "file")
      .map((e) => ({
        name: e.name,
        path: e.path.replace(/^subjects\//, ""),
        type: e.type === "dir" ? "dir" : "file",
      }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));

    await setCached(cacheKey, JSON.stringify(entries));
    return entries;
  });

export const getSubject = createServerFn({ method: "GET" })
  .inputValidator((d: { path: string }) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const path = data.path.replace(/^\/+|\/+$/g, "");
    const cacheKey = `readme:${path}`;
    const cached = await getCached(cacheKey);
    if (cached !== null) return { path, markdown: cached };

    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/subjects/${path}/README.md`;
    const res = await fetch(url, { headers: { "User-Agent": "lovable-mentor" } });
    if (!res.ok) {
      // Try as a file directly
      const url2 = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/subjects/${path}`;
      const res2 = await fetch(url2, { headers: { "User-Agent": "lovable-mentor" } });
      if (!res2.ok) return { path, markdown: "" };
      const md = await res2.text();
      await setCached(cacheKey, md);
      return { path, markdown: md };
    }
    const md = await res.text();
    await setCached(cacheKey, md);
    return { path, markdown: md };
  });
