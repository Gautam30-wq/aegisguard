/**
 * InputNormalizer — Pre-processing layer
 * Runs BEFORE any scanner. Decodes obfuscated payloads so regex/LLM
 * scanners always see the true intent of the input.
 *
 * Handles:
 *  1. URL encoding  (%20ignore%20prior%20instructions)
 *  2. Base64 blobs  (QWxhZGRpbjpvcGVuIHNlc2FtZQ==)
 *  3. HTML comments / metadata wrappers  (<!-- ignore previous -->)
 *  4. Unicode lookalike obfuscation (fullwidth chars, homoglyphs)
 *  5. Zero-width / invisible characters inserted to break regex
 */

export class InputNormalizer {

  // ── 1. URL Decode ────────────────────────────────────────────────────────
  // Repeatedly decode until stable (handles double/triple-encoded payloads)
  _urlDecode(text) {
    let prev = text;
    for (let i = 0; i < 5; i++) {
      try {
        const decoded = decodeURIComponent(prev);
        if (decoded === prev) break;
        prev = decoded;
      } catch {
        break; // malformed URI — stop here
      }
    }
    return prev;
  }

  // ── 2. Base64 Detection & Decode ─────────────────────────────────────────
  // Finds base64 blobs (≥ 20 chars) and appends their decoded form
  _decodeBase64Blobs(text) {
    // Match base64 strings: only A-Z a-z 0-9 + / = with min length 20
    const base64Regex = /[A-Za-z0-9+/]{20,}={0,2}/g;
    let extra = "";

    const matches = text.match(base64Regex) || [];
    for (const match of matches) {
      try {
        const decoded = Buffer.from(match, "base64").toString("utf-8");
        // Only use the decode if it looks like readable text
        if (/[\x20-\x7E]{5,}/.test(decoded)) {
          extra += " " + decoded;
        }
      } catch {
        // Not valid base64 — ignore
      }
    }

    return extra ? text + " [B64_DECODED: " + extra + "]" : text;
  }

  // ── 3. HTML Comment / Metadata Strip & Expose ────────────────────────────
  // Strip wrappers but append the inner content so scanners can see it
  _exposeHiddenText(text) {
    // HTML comments:  <!-- ... -->
    let exposed = text.replace(/<!--([\s\S]*?)-->/g, (_, inner) => inner.trim() + " ");

    // <script> or <meta> tag contents
    exposed = exposed.replace(/<(script|meta|style)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => inner.trim() + " ");

    // Strip any remaining HTML tags to get plain text underneath
    exposed = exposed.replace(/<[^>]+>/g, " ");

    return exposed.trim();
  }

  // ── 4. Unicode / Fullwidth Normalization ─────────────────────────────────
  // Converts fullwidth latin (ａ–ｚ) and lookalike chars to ASCII
  _normalizeUnicode(text) {
    // Fullwidth ASCII offset is 0xFEE0
    return text.replace(/[\uFF01-\uFF5E]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
  }

  // ── 5. Remove Zero-Width & Invisible Characters ───────────────────────────
  // Attackers insert these to break pattern matching
  _stripInvisible(text) {
    return text
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "") // zero-width
      .replace(/\u00AD/g, "");  // soft hyphen
  }

  // ── Master normalize() — call this before scanning ───────────────────────
  normalize(rawText) {
    let text = rawText;

    text = this._stripInvisible(text);
    text = this._normalizeUnicode(text);
    text = this._urlDecode(text);
    text = this._exposeHiddenText(text);
    text = this._decodeBase64Blobs(text);

    return text;
  }

  // Returns a summary of what was decoded (for logging/debug without raw data)
  describe(rawText, normalizedText) {
    const flags = [];
    if (rawText !== decodeURIComponent(rawText.replace(/%(?![0-9a-fA-F]{2})/g, "%25")))
      flags.push("URL-encoded");
    if (/[A-Za-z0-9+/]{20,}={0,2}/.test(rawText))
      flags.push("base64-blob");
    if (/<!--/.test(rawText))
      flags.push("HTML-comment");
    if (/[\uFF01-\uFF5E]/.test(rawText))
      flags.push("fullwidth-unicode");
    if (/[\u200B-\u200F]/.test(rawText))
      flags.push("zero-width-chars");
    return flags.length ? `[Normalizer decoded: ${flags.join(", ")}]` : null;
  }
}