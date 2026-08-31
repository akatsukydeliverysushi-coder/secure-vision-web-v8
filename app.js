let reader = null;
const $ = id => document.getElementById(id);

const log = m => {
  $("log").textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + $("log").textContent;
};

const status = (ok, t) => {
  $("status").textContent = t;
  $("status").className = "status " + (ok ? "online" : "offline");
};

function load() {
  const c = JSON.parse(localStorage.getItem("sv8") || "{}");
  if (c.url) $("whepUrl").value = c.url;
  if (c.user) $("user").value = c.user;
  if (c.pass) $("pass").value = c.pass;
}

function save() {
  localStorage.setItem("sv8", JSON.stringify({
    url: $("whepUrl").value.trim(),
    user: $("user").value,
    pass: $("pass").value
  }));
  log("Configuração salva neste navegador.");
}

function disconnect() {
  if (reader) {
    try { reader.close(); } catch {}
    reader = null;
  }
  $("video").srcObject = null;
  status(false, "OFFLINE");
  $("connectionText").textContent = "Câmera desconectada";
}

function connect() {
  disconnect();

  const url = $("whepUrl").value.trim();
  if (!url) {
    log("Informe a URL WHEP.");
    return;
  }

  if (typeof MediaMTXWebRTCReader !== "function") {
    log("reader.js não carregou.");
    return;
  }

  $("placeholder").classList.add("hidden");
  $("connectionText").textContent = "Conectando...";
  status(false, "CONECTANDO");
  log("Conectando: " + url);

  try {
    reader = new MediaMTXWebRTCReader({
      url,
      user: $("user").value,
      pass: $("pass").value,
      onError: e => {
        log("WebRTC: " + (e?.message || e));
        status(false, "ERRO");
        $("connectionText").textContent = "Falha na conexão";
        $("placeholder").classList.remove("hidden");
      },
      onTrack: e => {
        const stream = e.streams && e.streams[0];
        if (!stream) return;
        $("video").srcObject = stream;
        $("video").play().catch(() => {});
        status(true, "ONLINE");
        $("connectionText").textContent = "Transmissão ao vivo";
        log("Vídeo recebido.");
      }
    });
  } catch (e) {
    log("Falha: " + e.message);
    status(false, "ERRO");
    $("placeholder").classList.remove("hidden");
  }
}

$("connect").onclick = connect;
$("disconnect").onclick = disconnect;
$("save").onclick = save;
$("fullscreen").onclick = () => $("video").requestFullscreen?.();
$("sound").onclick = () => {
  $("video").muted = false;
  $("video").play().catch(() => {});
};

window.addEventListener("beforeunload", disconnect);
load();
