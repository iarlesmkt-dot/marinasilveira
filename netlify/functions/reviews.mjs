import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (t, max) => String(t || "").replace(/\s+/g, " ").trim().slice(0, max);

export default async (req, context) => {
  const store = getStore({ name: "marina", consistency: "strong" });
  const pin = (await store.get("pin")) || "1234";
  const list = (await store.get("reviews", { type: "json" })) || [];

  if (req.method === "GET") {
    const admin = req.headers.get("x-pin") === pin;
    const out = admin ? list : list.filter((r) => r.approved).map(({ id, name, rating, text, date }) => ({ id, name, rating, text, date, approved: true }));
    return J({ reviews: out.sort((a, b) => b.date.localeCompare(a.date)) });
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return J({ error: "json" }, 400); }

    // avaliação enviada por uma cliente (pública, entra "aguardando aprovação")
    if (b.action === "submit") {
      if (b.website) return J({ ok: true }); // campo escondido: robôs preenchem
      const name = clean(b.name, 60), text = clean(b.text, 600), rating = Math.round(Number(b.rating));
      if (name.length < 2 || text.length < 5 || !(rating >= 1 && rating <= 5)) return J({ error: "dados" }, 400);
      if (list.filter((r) => !r.approved).length >= 200) return J({ error: "cheio" }, 429);
      const ip = (context && context.ip) || "x";
      const key = "rl-" + createHash("sha256").update(ip).digest("hex").slice(0, 24);
      const last = Number(await store.get(key)) || 0;
      if (Date.now() - last < 60_000) return J({ error: "espere" }, 429);
      await store.set(key, String(Date.now()));
      list.push({ id: randomUUID(), name, rating, text, date: new Date().toISOString(), approved: false });
      await store.set("reviews", JSON.stringify(list));
      return J({ ok: true });
    }

    // ações da Marina (exigem senha)
    if (String(b.pin) !== pin) { await wait(800); return J({ error: "senha" }, 401); }
    const i = list.findIndex((r) => r.id === b.id);
    if (i < 0) return J({ error: "nao-encontrada" }, 404);
    if (b.action === "approve") list[i].approved = true;
    else if (b.action === "unapprove") list[i].approved = false;
    else if (b.action === "delete") list.splice(i, 1);
    else return J({ error: "acao" }, 400);
    await store.set("reviews", JSON.stringify(list));
    return J({ ok: true });
  }
  return J({ error: "metodo" }, 405);
};

export const config = { path: "/api/reviews" };
