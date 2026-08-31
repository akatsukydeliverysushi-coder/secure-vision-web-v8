@echo off
set FFMPEG=C:\Program Files\Agent\dlls\x64\ffmpeg.exe
"%FFMPEG%" -rtsp_transport tcp -i rtsp://127.0.0.1:8554/camera1 -map 0:v:0 -c:v libx264 -preset veryfast -tune zerolatency -profile:v baseline -level 3.1 -pix_fmt yuv420p -bf 0 -an -f rtsp rtsp://127.0.0.1:8554/camera1-h264
pause
