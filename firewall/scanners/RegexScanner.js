import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Navigate up from /firewall/scanners/ to /public/rules.json
const rulesPath = path.resolve(__dirname, '../../public/rules.json');

export class RegexScanner {
  constructor() {
    this.name = "RegexScanner";
    this.rules = [];
    this.categoryWeights = {};
    this.loadRules();
  }

  loadRules() {
    try {
      const fileData = fs.readFileSync(rulesPath, 'utf8');
      const data = JSON.parse(fileData);
      
      this.categoryWeights = data.categories || {};
      this.rules = data.rules.map(r => ({
        pattern: new RegExp(r.pattern, 'i'),
        weight: r.weight,
        category: r.category
      }));
      console.log("🛡️ [RegexScanner] Backend rules synced with rules.json");
    } catch (err) {
      console.error("⚠️ [RegexScanner] Failed to load rules.json. Ensure the file exists in the public directory.", err.message);
    }
  }

  async evaluate(text) {
    let score = 0;
    const lowerText = text.toLowerCase();
    const reasons = [];
    const matchedCategories = new Set();

    // Dynamically evaluate against JSON rules
    for (const rule of this.rules) {
      if (rule.pattern.test(lowerText)) {
        score += rule.weight;
        reasons.push(`Matched pattern from category: [${rule.category}]`);

        // Apply base category penalty only once per category
        if (rule.category && !matchedCategories.has(rule.category)) {
          score += (this.categoryWeights[rule.category] || 0);
          matchedCategories.add(rule.category);
        }
      }
    }

    // Keep the standalone long input penalty for doc-stuffing attacks
    if (text.length > 2000) {
      score += 15;
      reasons.push("Long input detected (>2000 chars)");
    }

    return {
      score,
      reason: reasons.length > 0 ? reasons.join("; ") : null
    };
  }
}