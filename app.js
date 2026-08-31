let reader = null;
const $ = (id) => document.getElementById(id);

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
    if (c.url) $("whepUrl").value = c.url;
    if (c.user) $("user").value = c.user;
    if (c.pass) $("pass").value = c.pass;
  } catch (e) {
    log("Não foi possível ler a configuração salva.");
  }
}

function saveConfig() {
  localStorage.setItem("sv8", JSON.stringify({
    url: $("whepUrl").value.trim(),
    user: $("user").value,
    pass: $("pass").value
  }));
  log("Configuração salva neste navegador.");
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

  const url = $("whepUrl").value.trim();

  if (!url) {
    log("Informe a URL WHEP.");
    return;
  }

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
      user: $("user").value,
      pass: $("pass").value,

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
