import { getStore } from "@netlify/blobs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  const store = getStore({ name: "marina", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("catalog", { type: "json" });
    return J({ data: data || null });
  }

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return J({ error: "json" }, 400); }
    const pin = (await store.get("pin")) || "1234";
    if (String(b.pin) !== pin) { await wait(800); return J({ error: "senha" }, 401); }
    if (b.action === "check") return J({ ok: true });

    if (b.newPin) {
      const np = String(b.newPin);
      if (np.length < 4 || np.length > 30) return J({ error: "senha-curta" }, 400);
      await store.set("pin", np);
    }
    if (b.data) {
      delete b.data.pin;
      const s = JSON.stringify(b.data);
      if (s.length > 3_000_000) return J({ error: "grande" }, 413);
      await store.set("catalog", s);
    }
    return J({ ok: true });
  }
  return J({ error: "metodo" }, 405);
};

export const config = { path: "/api/catalog" };
