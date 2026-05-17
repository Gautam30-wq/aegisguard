import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

import { Firewall } from "./firewall/Firewall.js";
import { RegexScanner } from "./firewall/scanners/RegexScanner.js";
import { LLMScanner } from "./firewall/scanners/LLMScanner.js";
import { DocumentScanner } from "./firewall/scanners/DocumentScanner.js";
import { createFirewallMiddleware } from "./firewall/middleware.js";

// Import the Google Gen AI SDK
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const firewallInstance = new Firewall()
  .use(new RegexScanner())
  .use(new LLMScanner())
  .use(new DocumentScanner());

const firewallMiddleware = createFirewallMiddleware(firewallInstance);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callLLM(text) {
  try {
    console.log(`👉 Sending to Gemini API:`, text.substring(0, 50) + "...");
    
    // Select the model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Execute the call
    const result = await model.generateContent(text);
    const response = await result.response;
    
    console.log("✅ Gemini API output OK");
    return response.text();

  } catch (err) {
    console.error("🔥 GEMINI ERROR:", err?.message || "unknown");
    return `⚠️ LLM ERROR: ${err?.message || "unknown"}`;
  }
}

app.post("/chat", firewallMiddleware, async (req, res) => {
  try {
    let userInput = req.body.wasSanitized ? req.body.sanitizedPrompt : req.body.message;
    
    if (!req.body.wasSanitized && req.body.documentContent) {
        userInput += "\n\nAttached Document:\n" + req.body.documentContent;
    }

    console.log("🤖 Calling LLM with input length:", userInput.length);

    const reply = await callLLM(userInput);

    console.log("✅ LLM RESPONSE RECEIVED");

    return res.json({
      reply,
      risk: req.body.firewallScore,
      blocked: false,
      sanitized: req.body.wasSanitized,
      sanitizedPrompt: req.body.sanitizedPrompt ?? null
    });

  } catch (err) {
    console.error("💥 BACKEND ERROR:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Replace your old app.listen loop at the bottom with this:
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

// 👉 CRITICAL ADDITION: Export the app module so Vercel can handle the serverless runtime routing
module.exports = app;