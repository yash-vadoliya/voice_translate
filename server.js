import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import translate from "google-translate-api-x"; // ✅ more stable fork

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve HTML files

// ✅ Translation route
app.post("/api/translate", async (req, res) => {
  const { text, target } = req.body;
  if (!text || !target)
    return res.status(400).json({ error: "Missing text or target language" });

  try {
    const result = await translate(text, { to: target });
    res.json({ translatedText: result.text });
  } catch (err) {
    console.error("Translation error:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

// ✅ Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`🌐 Server running at http://localhost:${PORT}`));