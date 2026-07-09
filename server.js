const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Groq = require("groq-sdk");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function extractText(file) {
  const ext = file.originalname.split(".").pop().toLowerCase();
  if (ext === "pdf") {
    const data = await pdfParse(file.buffer);
    return data.text;
  } else if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
  throw new Error("Unsupported file type. Please upload a PDF or DOCX.");
}

function buildPrompt(resumeText, jobDescription) {
  return `You are an expert resume reviewer. Analyze the following resume${
    jobDescription ? " against the job description provided" : ""
  } and return ONLY a JSON object with this exact structure, no markdown:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overall summary>",
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "keywords": { "found": ["<keyword>"], "missing": ["<keyword>"] },
  "sections": {
    "contact": "<feedback>",
    "summary": "<feedback>",
    "experience": "<feedback>",
    "education": "<feedback>",
    "skills": "<feedback>"
  }
}

Resume:
${resumeText}
${jobDescription ? `\nJob Description:\n${jobDescription}` : ""}`;
}

app.post("/review", upload.single("resume"), async (req, res) => {
  try {
    let resumeText = req.body.resumeText;

    if (req.file) {
      resumeText = await extractText(req.file);
    }

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({ error: "No resume content found." });
    }

    const jobDescription = req.body.jobDescription || "";
    const prompt = buildPrompt(resumeText, jobDescription);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to analyze resume." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
