let reader = null;
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
    $("whepUrl").value = c.url || DEFAULT_WHEP;

    // Credentials are intentionally NOT restored from localStorage.
    $("user").value = "";
    $("pass").value = "";

    // Remove any credentials saved by previous V8 versions.
    if (c.user || c.pass) {
      localStorage.setItem("sv8", JSON.stringify({ url: c.url || DEFAULT_WHEP }));
      log("Credenciais antigas removidas do navegador.");
    }
  } catch (e) {
    $("whepUrl").value = DEFAULT_WHEP;
    $("user").value = "";
    $("pass").value = "";
  }
}

function saveConfig() {
  // Only the endpoint is persisted. User/password are never stored.
  localStorage.setItem("sv8", JSON.stringify({
    url: $("whepUrl").value.trim() || DEFAULT_WHEP
  }));
  log("URL salva neste navegador. Usuário e senha não são armazenados.");
}

function disconnect() {
  if (reader) {
    try { reader.close(); } catch (e) {}
    reader = null;
  }

  const video = $("video");
  if (video) {
    video.pause();
    video.srcObject = null;
  }

  const placeholder = $("placeholder");
  if (placeholder) placeholder.classList.remove("hidden");

  setStatus("offline", "OFFLINE");
}

function connect() {
  disconnect();

  const url = $("whepUrl").value.trim() || DEFAULT_WHEP;

  if (typeof MediaMTXWebRTCReader !== "function") {
    log("ERRO: reader.js não carregou.");
    setStatus("offline", "ERRO");
    return;
  }

  $("placeholder").classList.add("hidden");
  setStatus("offline", "CONECTANDO");
  log("Conectando ao WHEP: " + url);

  try {
    reader = new MediaMTXWebRTCReader({
      url,
      user: "",
      pass: "",

      onError: (error) => {
        log("WebRTC: " + (error?.message || error));
        setStatus("offline", "ERRO");
        $("placeholder").classList.remove("hidden");
      },

      onTrack: (event) => {
        const stream = event.streams && event.streams[0];
        if (!stream) {
          log("WebRTC recebeu uma faixa sem MediaStream.");
          return;
        }

        const video = $("video");
        video.srcObject = stream;
        video.play().catch(() => {});

        setStatus("online", "ONLINE");
        $("placeholder").classList.add("hidden");
        log("Stream WebRTC recebido.");
      }
    });
  } catch (error) {
    log("Falha ao iniciar WebRTC: " + (error?.message || error));
    setStatus("offline", "ERRO");
    $("placeholder").classList.remove("hidden");
  }
}

$("connect").addEventListener("click", connect);
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

window.addEventListener("beforeunload", disconnect);
loadConfig();
