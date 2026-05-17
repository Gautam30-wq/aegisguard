// ── State ─────────────────────────────────────────────
let isDanger = false;
let currentScore = 12;
let targetScore = 12;
let animFrame = null;

// ── Gauge Animation ───────────────────────────────────
const CIRC = 301.59;

function scoreToOffset(score) {
    return CIRC - (score / 100) * CIRC;
}

function setGaugeImmediate(score, danger, warn) {
    const fill = document.getElementById('gauge-fill');
    const scoreEl = document.getElementById('gauge-score');
    const labelEl = document.getElementById('gauge-label');
    const statusEl = document.getElementById('gauge-status');
    const levelTag = document.getElementById('gauge-level-tag');
    const alertBan = document.getElementById('alert-banner');
    const execBtn = document.getElementById('exec-btn');
    const statusDot = document.getElementById('status-dot');

    score = Math.max(0, Math.min(100, score));

    const offset = CIRC - (score / 100) * CIRC;
    if (fill) fill.style.strokeDashoffset = offset;

    if (scoreEl) scoreEl.textContent = Math.round(score);

    if (fill) fill.classList.remove('warn', 'danger');
    if (scoreEl) scoreEl.classList.remove('warn', 'danger');
    if (statusEl) statusEl.classList.remove('warn', 'danger');
    if (statusDot) statusDot.classList.remove('danger');
    if (execBtn) execBtn.classList.remove('danger');
    if (alertBan) alertBan.classList.remove('show');

    document.body.classList.remove('danger-mode');

    if (score < 40) {
        if (labelEl) labelEl.textContent = "SAFE ZONE";
        if (statusEl) statusEl.textContent = "● MINIMAL THREAT";
        if (levelTag) levelTag.textContent = "SAFE";
        if (fill) fill.style.stroke = "#00FFC2";
        if (statusDot) statusDot.style.background = "#00FFC2";
    } else if (score < 75) {
        if (fill) fill.classList.add('warn');
        if (scoreEl) scoreEl.classList.add('warn');
        if (statusEl) statusEl.classList.add('warn');
        if (labelEl) labelEl.textContent = "CAUTION ZONE";
        if (statusEl) statusEl.textContent = "● SUSPICIOUS INPUT";
        if (levelTag) levelTag.textContent = "WARN";
        if (fill) fill.style.stroke = "#FFB347";
        if (statusDot) statusDot.style.background = "#FFB347";
    } else {
        if (fill) fill.classList.add('danger');
        if (scoreEl) scoreEl.classList.add('danger');
        if (statusEl) statusEl.classList.add('danger');
        if (labelEl) labelEl.textContent = "DANGER ZONE";
        if (statusEl) statusEl.textContent = "● THREAT DETECTED";
        if (levelTag) levelTag.textContent = "DANGER";
        if (fill) fill.style.stroke = "#FF4B5C";
        if (statusDot) statusDot.classList.add('danger');
        if (execBtn) execBtn.classList.add('danger');
        if (alertBan) alertBan.classList.add('show');
        document.body.classList.add('danger-mode');
    }
}

function animateGauge(from, to, danger, warn) {
    if (animFrame) cancelAnimationFrame(animFrame);
    const duration = 600;
    const start = performance.now();

    function step(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const current = from + (to - from) * eased;
        setGaugeImmediate(current, danger, warn);
        if (t < 1) animFrame = requestAnimationFrame(step);
    }
    animFrame = requestAnimationFrame(step);
}

// ── Real-time Input Scanning (live gauge on keyup) ─────
document.getElementById('chat-input').addEventListener('input', function () {
    const text = this.value.toLowerCase();
    let score = 0;

    const rules = [
        { pattern: /ignore (all )?(previous|instructions)/i, weight: 35 },
        { pattern: /jailbreak|dev mode|developer mode/i, weight: 50 },
        { pattern: /system prompt|override/i, weight: 45 },
        { pattern: /pretend to be|act as if/i, weight: 25 },
        { pattern: /unrestricted|no restrictions/i, weight: 40 },
        { pattern: /roleplay as|new persona/i, weight: 20 }
    ];

    rules.forEach(r => {
        if (r.pattern.test(text)) {
            score += r.weight;
        }
    });

    score = Math.min(100, score);
    const danger = score >= 75;
    const warn = score >= 40 && score < 75;

    animateGauge(currentScore, score, danger, warn);
    currentScore = score;
    isDanger = danger;
});

// ── Send Message ──────────────────────────────────────
async function sendMessage() {
    const inputEl = document.getElementById('chat-input');
    const fileInput = document.getElementById('file-input');
    
    const message = inputEl?.value.trim();
    const file = fileInput?.files[0];
    
    if (!message && !file) return;

    let displayMsg = message || "";
    if (file) {
        displayMsg += displayMsg ? `\n[📎 Attached: ${file.name}]` : `[📎 Attached: ${file.name}]`;
    }
    appendMessage('user', displayMsg);
    
    let documentContent = "";
    if (file) {
        try {
            documentContent = await file.text();
        } catch (e) {
            console.error("Error reading file", e);
            appendMessage('ai', "Error reading attached file.", true);
            return;
        }
    }

    inputEl.value = '';
    fileInput.value = ''; 
    document.getElementById('attach-btn').style.color = "var(--text-muted)"; 

    try {
        const response = await fetch("http://localhost:3000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: message || "", 
                documentContent: documentContent,
                enableFirewall: document.getElementById('firewall-toggle')?.checked !== false
            })
        });

        const data = await response.json();

        // Sync local client gauge tracking to reflect backend's evaluation score
        const postScore = data.risk ?? 0;
        animateGauge(currentScore, postScore, postScore >= 75, postScore >= 40 && postScore < 75);
        currentScore = postScore;

        addLogEntry(message || (file ? file.name : "Attachment"), data.blocked);

        if (data.blocked) {
            appendMessage('ai', `🚫 Blocked: ${data.reply}`, true);
            return;
        }

        if (data.sanitized) {
            appendMessage('ai', `⚠️ Warning: Your prompt contained potentially unsafe content and was partially sanitized before execution.`, true);
        }

        appendMessage('ai', data.reply, false);

        if (data.sanitized && data.sanitizedPrompt) {
            appendMessage('ai', `Sanitized prompt sent to LLM: \n"${data.sanitizedPrompt}"`, false);
        }

    } catch (err) {
        console.error("Connection error:", err);
        appendMessage('ai', "Error connecting to the security server.", true);
    }
}

function appendMessage(role, content, danger = false) {
    const msgs = document.getElementById('messages');
    const typingEl = document.getElementById('typing-indicator');

    if (!msgs) return;

    const row = document.createElement('div');
    row.className = `msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = role === 'user' ? 'msg-avatar user-av' : 'msg-avatar';
    avatar.textContent = role === 'user' ? 'ME' : 'AG';

    const bubble = document.createElement('div');
    bubble.className = danger ? 'msg-bubble danger-msg' : 'msg-bubble';
    bubble.textContent = content;

    row.appendChild(avatar);
    row.appendChild(bubble);

    if (typingEl && typingEl.parentNode === msgs) {
        msgs.insertBefore(row, typingEl);
    } else {
        msgs.appendChild(row);
    }
    msgs.scrollTop = msgs.scrollHeight;
}

function addLogEntry(text, threat) {
    const log = document.getElementById('threat-log');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const label = threat
        ? `Blocked: "${text.slice(0, 22)}${text.length > 22 ? '…' : ''}"`
        : `Cleared: "${text.slice(0, 22)}${text.length > 22 ? '…' : ''}"`;

    entry.innerHTML = `
        <div class="log-dot ${threat ? 'threat' : 'safe'}"></div>
        <span>${label}</span>
        <span class="log-time">${time}</span>
    `;

    log.prepend(entry);

    while (log.children.length > 8) {
        log.removeChild(log.lastChild);
    }
}

document.getElementById('chat-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
});

document.getElementById('file-input').addEventListener('change', function (e) {
    const btn = document.getElementById('attach-btn');
    if (this.files && this.files.length > 0) {
        btn.style.color = "var(--green)"; 
        btn.title = this.files[0].name;
    } else {
        btn.style.color = "var(--text-muted)";
        btn.title = "Attach file";
    }
});

function buildHealthBars() {
    const container = document.getElementById('health-bars');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar-col';
        bar.style.height = Math.floor(Math.random() * 80 + 10) + '%';
        container.appendChild(bar);
    }
}
buildHealthBars();

setInterval(() => {
    const bars = document.querySelectorAll('.bar-col');
    const dangerMode = document.body.classList.contains('danger-mode');
    bars.forEach(bar => {
        const h = dangerMode
            ? Math.floor(Math.random() * 60 + 40)
            : Math.floor(Math.random() * 70 + 10);
        bar.style.height = h + '%';
        bar.className = dangerMode ? 'bar-col danger' : 'bar-col';
    });
}, 450);

setInterval(() => {
    const dangerMode = document.body.classList.contains('danger-mode');
    const bpm = dangerMode
        ? Math.floor(Math.random() * 30 + 95)
        : Math.floor(Math.random() * 10 + 64);
    const el = document.getElementById('health-ping');
    if (el) {
        el.textContent = bpm + ' BPM';
        el.style.color = dangerMode ? 'var(--red)' : 'var(--green)';
    }
}, 1200);

setInterval(() => {
    const ms = (Math.random() * 1.5 + 0.5).toFixed(1);
    const el = document.getElementById('h-scan');
    if (el) el.textContent = ms + 'ms';
}, 2000);

let uptimeSeconds = 0;
setInterval(() => {
    uptimeSeconds++;
    const h = String(Math.floor(uptimeSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(uptimeSeconds % 60).padStart(2, '0');
    const el = document.getElementById('h-uptime'); // FIX: Match correct node inside DOM grid
    if (el) el.textContent = `${h}:${m}:${s}`;
}, 1000);

(function drawPulse() {
    const canvas = document.getElementById('pulse-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth || 250;
    const H = 36;
    canvas.width = W;
    canvas.height = H;

    const points = Array.from({ length: W }, () => H / 2);
    let x = 0;

    function animate() {
        const dangerMode = document.body.classList.contains('danger-mode');
        const color = dangerMode ? '#FF4B5C' : '#00FFC2';
        const amplitude = dangerMode ? H * 0.45 : H * 0.3;
        const freq = dangerMode ? 0.25 : 0.15;

        points.shift();
        const newY = H / 2 + amplitude * Math.sin(x * freq) * (0.6 + 0.4 * Math.random());
        points.push(newY);
        x += 1;

        ctx.clearRect(0, 0, W, H);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = dangerMode ? 6 : 4;
        ctx.shadowColor = color;
        ctx.moveTo(0, points[0]);
        points.forEach((py, px) => ctx.lineTo(px, py));
        ctx.stroke();

        requestAnimationFrame(animate);
    }
    animate();
})();