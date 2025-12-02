// api/translate.js
import translate from "google-translate-api-x";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // Vercel usually parses JSON into req.body. Try that first; fallback to raw parsing.
    let body = req.body;
    if (!body || Object.keys(body).length === 0) {
      // fallback for raw parsing
      body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => data += chunk);
        req.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
        });
        req.on("error", reject);
      });
    }

    const { text, target } = body || {};
    if (!text || !target) return res.status(400).json({ error: "Missing text or target language" });

    const result = await translate(text, { to: target });
    return res.status(200).json({ translatedText: result.text });
  } catch (error) {
    console.error("Translation error:", error?.message || error);
    return res.status(500).json({ error: "Translation failed" });
  }
}
