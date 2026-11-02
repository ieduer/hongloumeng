// 石頭收服 /api/play/*：對局、排行、暱稱、雲端存檔。邏輯在 ../../_shared/play/engine.js。
import { handlePlay } from "../../_shared/play/engine.js";

const USER_CENTER = "https://my.bdfz.net";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const bad = (message, status = 400) => json({ error: message }, status);

// 身分只認 my.bdfz.net 的工作階段：把 bdfz_uc_session cookie 原樣交給用戶中心核驗，本站不存帳密。
async function currentUser(request) {
  const cookie = request.headers.get("cookie") || "";
  if (!cookie.includes("bdfz_uc_session=")) return null;
  try {
    const response = await fetch(`${USER_CENTER}/api/session`, { headers: { Cookie: cookie, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.authenticated || !payload?.user?.slug) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  try {
    return await handlePlay(context.request, context.env, url, { json, bad, currentUser });
  } catch {
    return bad("server error", 500);
  }
}
