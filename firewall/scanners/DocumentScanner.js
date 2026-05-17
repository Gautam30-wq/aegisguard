export class DocumentScanner {
  constructor() {
    this.name = "DocumentScanner";
    // Signatures of suspicious content in documents
    this.suspiciousPatterns = [
      /eval\s*\(/i, 
      /exec\s*\(/i,
      /document\.cookie/i,
      /window\.location/i,
      /(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/, // Long base64 strings
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i // Embedded scripts
    ];
  }

  async evaluate(text) {
    // If text is extremely large, penalize it slightly or heavily if it has code
    const lengthScore = text.length > 50000 ? 20 : 0; // Very large documents get a minor penalty
    
    let patternScore = 0;
    let foundPatterns = [];

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        patternScore += 30; // Add 30 for each suspicious pattern found
        foundPatterns.push(pattern.toString());
      }
    }

    const totalScore = lengthScore + patternScore;

    if (totalScore > 0) {
      return {
        score: totalScore,
        reason: `Document scanner detected suspicious patterns or excessive length. Patterns: ${foundPatterns.join(", ")}`
      };
    }

    return { score: 0 };
  }
}
