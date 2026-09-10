# New-HRMS PowerShell Launcher
$pythonPath = "$PSScriptRoot\backend\venv\Scripts\python.exe"
if (Test-Path $pythonPath) {
    & $pythonPath "$PSScriptRoot\start.py"
} else {
    & python "$PSScriptRoot\start.py"
}
