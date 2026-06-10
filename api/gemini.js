const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

function getRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
}

function uniqueModels(models) {
  const requested = Array.isArray(models) ? models : [];
  return [...new Set([...requested, ...DEFAULT_MODELS].map((model) => String(model || "").trim()).filter(Boolean))];
}

function shouldTryFallbackModel(status, message) {
  return status === 503 || status === 429 || status === 404 || /high demand|overloaded|temporar|try again|not found/i.test(message || "");
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
    error.retryableModel = shouldTryFallbackModel(response.status, message);
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

  let lastError = null;
  for (const model of uniqueModels(payload.models)) {
    try {
      const text = await requestGeminiModel(model, apiKey, body);
      return sendJson(res, 200, { model, text });
    } catch (error) {
      lastError = error;
      if (!error.retryableModel) break;
    }
  }

  if (lastError?.retryableModel) {
    return sendJson(res, 503, {
      error: "AI 모델 호출이 실패했습니다. 수요가 높거나 대체 모델을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  return sendJson(res, lastError?.status || 500, {
    error: lastError?.message || "AI 응답을 가져오지 못했습니다.",
  });
};
