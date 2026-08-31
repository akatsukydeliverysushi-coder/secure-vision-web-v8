@echo off
title Secure Vision V8 - Camera 1 H264

:RESTART
echo.
echo ==========================================
echo   CAMERA 1 - H265 para H264
echo ==========================================
echo Iniciando FFmpeg...
echo.

"C:\Program Files\Agent\dlls\x64\ffmpeg.exe" ^
-rtsp_transport tcp ^
-i "rtsp://127.0.0.1:8554/camera1" ^
-map 0:v:0 ^
-c:v libx264 ^
-preset veryfast ^
-tune zerolatency ^
-profile:v baseline ^
-level 3.1 ^
-pix_fmt yuv420p ^
-bf 0 ^
-g 24 ^
-keyint_min 12 ^
-sc_threshold 0 ^
-an ^
-f rtsp ^
-rtsp_transport tcp ^
"rtsp://127.0.0.1:8554/camera1-h264"

echo.
echo FFmpeg encerrou. Reiniciando em 3 segundos...
timeout /t 3 /nobreak >nul
goto RESTART
