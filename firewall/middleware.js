import { Sanitizer } from "./Sanitizer.js";

export function createFirewallMiddleware(firewallInstance) {
  const sanitizer = new Sanitizer();

  return async (req, res, next) => {
    try {
      const userInput = req.body?.message || "";
      const docInput = req.body?.documentContent || "";
      const enableFirewall = req.body?.enableFirewall !== false;
      
      const combinedInput = userInput + (docInput ? "\n\n" + docInput : "");

      if (!combinedInput) {
        return res.status(400).json({ error: "No message or document provided" });
      }

      if (!enableFirewall) {
        console.log("🛡️ Firewall bypassed by user toggle.");
        req.body.wasSanitized = false;
        req.body.firewallScore = 0;
        return next();
      }

      console.log("🛡️ Firewall scanning input...");
      const scanResult = await firewallInstance.scan(combinedInput);
      console.log("🛡️ Scan Result:", scanResult);

      if (scanResult.status === "blocked") {
        return res.json({
          reply: "🚫 Blocked by firewall: Your input triggered critical security alerts.",
          risk: scanResult.score,
          blocked: true,
          details: scanResult.details
        });
      }

      if (scanResult.status === "suspicious") {
        console.log("⚠️ Prompt is suspicious. Sanitizing...");
        
        const sanitizedInput = sanitizer.sanitize(userInput);
        const sanitizedDoc = docInput ? sanitizer.sanitize(docInput) : "";
        
        req.body.message = sanitizedInput;
        req.body.documentContent = sanitizedDoc;
        req.body.wasSanitized = true;
        req.body.sanitizedPrompt = sanitizedInput + (sanitizedDoc ? "\n\nAttached Document:\n" + sanitizedDoc : "");
        req.body.firewallScore = scanResult.score;
      } else {
        req.body.wasSanitized = false;
        req.body.firewallScore = scanResult.score;
      }

      next();
    } catch (err) {
      console.error("💥 Firewall Middleware Error:", err);
      return res.status(500).json({
        error: "Internal Firewall Error"
      });
    }
  };
}