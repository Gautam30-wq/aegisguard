import { InputNormalizer } from "./InputNormalizer.js";

export class Firewall {
  constructor() {
    this.scanners = [];
    this.normalizer = new InputNormalizer();
  }

  use(scanner) {
    this.scanners.push(scanner);
    return this;
  }

  async scan(rawText) {
    // ── Step 0: Normalize — decode all obfuscation layers first ─────────────
    const normalizedText = this.normalizer.normalize(rawText);
    const decodeNote = this.normalizer.describe(rawText, normalizedText);
    if (decodeNote) {
      console.log(`🔍 [Firewall] ${decodeNote}`);
    }

    let totalScore = 0;
    const details = [];

    // ── Step 1: Run all scanners on the NORMALIZED text ────────────────────
    for (const scanner of this.scanners) {
      try {
        const result = await scanner.evaluate(normalizedText);
        if (result && result.score > 0) {
          totalScore += result.score;
          details.push({
            scanner: scanner.name,
            score: result.score,
            reason: result.reason || "Matched restricted pattern"
          });
        }
      } catch (err) {
        console.error(`[Firewall] Scanner ${scanner.name} failed:`, err);
      }
    }

    let status = "clean";
    if (totalScore >= 75) {
      status = "blocked";
    } else if (totalScore >= 40) {
      status = "suspicious";
    }

    return {
      status,
      score: totalScore,
      details,
      wasNormalized: normalizedText !== rawText  // flag if any decoding happened
    };
  }
}