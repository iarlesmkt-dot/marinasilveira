import { getStore } from "@netlify/blobs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  const store = getStore({ name: "marina", consistency: "strong" });

  if (req.method === "POST") {
    const pin = (await store.get("pin")) || "1234";
    if (req.headers.get("x-pin") !== pin) { await wait(800); return J({ error: "senha" }, 401); }
    const type = (req.headers.get("content-type") || "").split(";")[0];
    if (!type.startsWith("image/")) return J({ error: "tipo" }, 400);
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 3_000_000) return J({ error: "grande" }, 413);
    const id = crypto.randomUUID();
    await store.set("photo-" + id, buf, { metadata: { type } });
    return J({ url: "/api/photo/" + id });
  }

  if (req.method === "GET") {
    const id = new URL(req.url).pathname.split("/").pop();
    if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("not found", { status: 404 });
    const r = await store.getWithMetadata("photo-" + id, { type: "arrayBuffer" });
    if (!r) return new Response("not found", { status: 404 });
    return new Response(r.data, {
      headers: { "content-type": (r.metadata && r.metadata.type) || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  }
  return J({ error: "metodo" }, 405);
};

export const config = { path: ["/api/photo", "/api/photo/*"] };
