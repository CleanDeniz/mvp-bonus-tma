import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const SKIP_TG_AUTH = String(process.env.SKIP_TG_AUTH || "false") === "true";

function checkTelegramAuth(initData) {
  if (SKIP_TG_AUTH) return { ok: true, data: {} };

  if (!BOT_TOKEN) return { ok: false, error: "BOT_TOKEN is missing" };
  if (!initData) return { ok: false, error: "initData missing" };

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckArr = [];
  for (const [key, value] of urlParams.entries()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();

  const hmac = crypto.createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const valid = hmac === hash;
  if (!valid) return { ok: false, error: "initData hash invalid" };

  const userStr = urlParams.get("user");
  const user = userStr ? JSON.parse(userStr) : null;
  return { ok: true, data: { user } };
}

export function authMiddleware(req, res, next) {
  try {
    const initData = req.headers["x-telegram-init-data"];
    const result = checkTelegramAuth(initData);
    if (!result.ok) return res.status(401).json({ error: result.error });

    req.tgUser = result.data.user || null;
    next();
  } catch (e) {
    return res.status(401).json({ error: "auth failed" });
  }
}
