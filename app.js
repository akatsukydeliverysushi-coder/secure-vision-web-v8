let reader = null;
let reconnectTimer = null;
let manualDisconnect = false;
let reconnectAttempts = 0;

const $ = (id) => document.getElementById(id);
const DEFAULT_WHEP = "http://127.0.0.1:8889/camera1-h264/whep";

const log = (message) => {
  const el = $("log");
  if (!el) return;
  el.textContent =
    `[${new Date().toLocaleTimeString()}] ${message}\n` + el.textContent;
};

const setStatus = (state, text) => {
  const el = $("status");
  if (!el) return;
  el.textContent = text;
  el.className = "status " + state;
};

function loadConfig() {
  try {
    const c = JSON.parse(localStorage.getItem("sv8") || "{}");
    const savedUrl = (c.url || "").trim();
    $("whepUrl").value = savedUrl.startsWith("http") && !savedUrl.startsWith("URL WHEP:")
      ? savedUrl
      : DEFAULT_WHEP;

    // Never restore or persist credentials.
    $("user").value = "";
    $("pass").value = "";

    // Clean legacy values and malformed URL values saved by older versions.
    localStorage.setItem("sv8", JSON.stringify({ url: $("whepUrl").value }));
  } catch (e) {
    $("whepUrl").value = DEFAULT_WHEP;
    $("user").value = "";
    $("pass").value = "";
  }
}

function saveConfig() {
  const url = $("whepUrl").value.trim();
  const cleanUrl = url.replace(/^URL WHEP:\s*/i, "").trim() || DEFAULT_WHEP;
  $("whepUrl").value = cleanUrl;
  localStorage.setItem("sv8", JSON.stringify({ url: cleanUrl }));
  $("user").value = "";
  $("pass").value = "";
  log("URL salva. Usuário e senha não são armazenados.");
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function destroyReader() {
  if (reader) {
    try { reader.close(); } catch (e) {}
    reader = null;
  }
}

function disconnect() {
  manualDisconnect = true;
  clearReconnectTimer();
  destroyReader();

  const video = $("video");
  if (video) {
    video.pause();
    video.srcObject = null;
  }

  const placeholder = $("placeholder");
  if (placeholder) placeholder.classList.remove("hidden");

  setStatus("offline", "OFFLINE");
}

function scheduleReconnect(reason) {
  if (manualDisconnect || reconnectTimer) return;

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.max(1, reconnectAttempts), 5000);
  log(`${reason || "WebRTC desconectado"}. Reconectando em ${Math.round(delay / 1000)}s...`);
  setStatus("offline", "RECONEXÃO");

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!manualDisconnect) connect(true);
  }, delay);
}

function connect(isReconnect = false) {
  manualDisconnect = false;
  clearReconnectTimer();
  destroyReader();

  const rawUrl = $("whepUrl").value.trim();
  const url = (rawUrl.replace(/^URL WHEP:\s*/i, "").trim() || DEFAULT_WHEP);
  $("whepUrl").value = url;

  if (typeof MediaMTXWebRTCReader !== "function") {
    log("ERRO: reader.js não carregou.");
    setStatus("offline", "ERRO");
    return;
  }

  $("placeholder").classList.add("hidden");
  setStatus("offline", isReconnect ? "RECONCETANDO" : "CONECTANDO");
  log((isReconnect ? "Reconectando ao WHEP: " : "Conectando ao WHEP: ") + url);

  try {
    reader = new MediaMTXWebRTCReader({
      url,
      user: "",
      pass: "",

      onError: (error) => {
        if (manualDisconnect) return;
        log("WebRTC: " + (error?.message || error));
        scheduleReconnect("Falha WebRTC");
      },

      onTrack: (event) => {
        if (manualDisconnect) return;
        const stream = event.streams && event.streams[0];
        if (!stream) {
          log("WebRTC recebeu uma faixa sem MediaStream.");
          return;
        }

        const video = $("video");
        video.srcObject = stream;
        video.play().catch(() => {});

        reconnectAttempts = 0;
        setStatus("online", "ONLINE");
        $("placeholder").classList.add("hidden");
        log("Stream WebRTC recebido. Conexão ONLINE.");
      }
    });
  } catch (error) {
    log("Falha ao iniciar WebRTC: " + (error?.message || error));
    scheduleReconnect("Falha ao iniciar WebRTC");
  }
}

$("connect").addEventListener("click", () => connect(false));
$("disconnect").addEventListener("click", disconnect);
$("save").addEventListener("click", saveConfig);

$("fullscreen").addEventListener("click", () => {
  const video = $("video");
  if (video?.requestFullscreen) video.requestFullscreen();
});

$("sound").addEventListener("click", () => {
  const video = $("video");
  video.muted = false;
  video.play().catch(() => {});
  log("Áudio ativado no navegador.");
});

window.addEventListener("beforeunload", () => {
  manualDisconnect = true;
  clearReconnectTimer();
  destroyReader();
});

loadConfig();
