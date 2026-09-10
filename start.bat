@echo off
title New-HRMS Fullstack Launcher
color 0b
cls

if exist "%~dp0backend\venv\Scripts\python.exe" (
    "%~dp0backend\venv\Scripts\python.exe" "%~dp0start.py"
) else (
    python "%~dp0start.py"
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Launcher encountered an error.
    pause
)
