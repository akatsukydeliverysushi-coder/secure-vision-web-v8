# Secure Vision V7 — PWA WebRTC

Câmera RTSP/H.265 → FFmpeg H.264 → MediaMTX → WHEP/WebRTC → navegador.

Para máxima compatibilidade, use H.264 Baseline e `-bf 0`.

Com o MediaMTX rodando, o FFmpeg pode publicar no segundo caminho:

```bat
"C:\Program Files\Agent\dlls\x64\ffmpeg.exe" -rtsp_transport tcp -i rtsp://127.0.0.1:8554/camera1 -map 0:v:0 -c:v libx264 -preset veryfast -tune zerolatency -profile:v baseline -level 3.1 -pix_fmt yuv420p -bf 0 -an -f rtsp rtsp://127.0.0.1:8554/camera1-h264
```

O app usa:
`http://127.0.0.1:8889/camera1-h264/whep`

Não publique a senha da câmera no GitHub. Em GitHub Pages HTTPS, um MediaMTX HTTP local pode ser bloqueado por mixed content; para acesso remoto use HTTPS/reverse proxy ou VPN.
