# Secure Vision V8 — PWA WebRTC

Fluxo:
Câmera RTSP/H.265 → FFmpeg H.264 → MediaMTX → WHEP/WebRTC → navegador.

## Teste local

1. Inicie o MediaMTX.
2. Execute `start-h264.bat`.
3. Execute `start-local.bat`.
4. Abra `http://127.0.0.1:8080`.
5. A URL WHEP padrão é:
   `http://127.0.0.1:8889/camera1-h264/whep`

## Arquivos

- `index.html` — interface.
- `app.js` — controles e conexão.
- `reader.js` — cliente WHEP/WebRTC.
- `style.css` — visual.
- `start-h264.bat` — conversão H.265 → H.264 com reinício automático.
- `start-local.bat` — servidor HTTP local.

## Segurança

Não publique a URL RTSP, usuário ou senha da câmera no GitHub.
Em GitHub Pages HTTPS, um endpoint HTTP local pode ser bloqueado por mixed content. Para acesso remoto, use HTTPS no endpoint WHEP e configure ICE/STUN/TURN quando necessário.
