const DEFAULT_MODEL = "gemini-2.5-flash-lite";

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
}

function selectModel(models) {
  const requested = Array.isArray(models) ? models : [];
  return requested.map((model) => String(model || "").trim()).find(Boolean) || DEFAULT_MODEL;
}

async function requestGeminiModel(model, apiKey, body) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `AI API request failed. (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return sendJson(res, 500, { error: "GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다." });
  }

  let payload;
  try {
    payload = getRequestBody(req);
  } catch {
    return sendJson(res, 400, { error: "요청 JSON을 읽지 못했습니다." });
  }

  const body = payload.body;
  if (!body || !Array.isArray(body.contents)) {
    return sendJson(res, 400, { error: "AI 요청 본문이 올바르지 않습니다." });
  }

  const model = selectModel(payload.models);
  try {
    const text = await requestGeminiModel(model, apiKey, body);
    return sendJson(res, 200, { model, text });
  } catch (error) {
    const status = error.status || 500;
    const message =
      status === 429
        ? "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : status === 503
          ? "AI 모델이 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요."
          : error.message || "AI 응답을 가져오지 못했습니다.";
    return sendJson(res, status, { error: message, model });
  }
};
