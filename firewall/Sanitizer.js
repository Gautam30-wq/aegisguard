import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, '../public/rules.json');

export class Sanitizer {
  constructor() {
    this.rules = [];
    this.loadRules();
  }

  loadRules() {
    try {
      const fileData = fs.readFileSync(rulesPath, 'utf8');
      const data = JSON.parse(fileData);
      
      // Compile the regex globally so it catches multiple instances in one prompt
      this.rules = data.rules.map(r => ({
        pattern: new RegExp(r.pattern, 'gi'),
        action: r.action // "mask" or "remove"
      }));
      console.log("🛡️ [Sanitizer] Action definitions synced with rules.json");
    } catch (err) {
      console.error("⚠️ [Sanitizer] Failed to load rules.json.", err.message);
    }
  }

  sanitize(text) {
    let sanitizedText = text;
    
    for (const rule of this.rules) {
      if (rule.action === "mask") {
        sanitizedText = sanitizedText.replace(rule.pattern, "[REDACTED]");
      } else if (rule.action === "remove") {
        sanitizedText = sanitizedText.replace(rule.pattern, "");
      }
    }
    
    // Clean up any awkward double spaces caused by "remove" actions
    return sanitizedText.replace(/\s{2,}/g, ' ').trim();
  }
}