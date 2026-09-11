import os
import sys
import time
import subprocess
import signal
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "Frontend"

def find_venv_python():
    """Find virtualenv python executable across Windows and Linux/Ubuntu."""
    if os.name == "nt":
        candidates = [
            BACKEND_DIR / "venv" / "Scripts" / "python.exe",
            ROOT_DIR / "venv" / "Scripts" / "python.exe",
            BACKEND_DIR / ".venv" / "Scripts" / "python.exe",
            ROOT_DIR / ".venv" / "Scripts" / "python.exe",
        ]
    else:
        candidates = [
            BACKEND_DIR / "venv" / "bin" / "python",
            BACKEND_DIR / "venv" / "bin" / "python3",
            ROOT_DIR / "venv" / "bin" / "python",
            ROOT_DIR / "venv" / "bin" / "python3",
            BACKEND_DIR / ".venv" / "bin" / "python",
            BACKEND_DIR / ".venv" / "bin" / "python3",
            ROOT_DIR / ".venv" / "bin" / "python",
        ]
    for c in candidates:
        if c.is_file():
            return c
    return None

def ensure_venv(reexec=True):
    """
    Automatically activate/switch to virtual environment.
    If run with system python, re-executes under the venv python without manual activation.
    """
    venv_python = find_venv_python()
    if not venv_python:
        print("[Auto-Venv] Virtual environment not detected. Initializing backend/venv ...")
        try:
            venv_path = BACKEND_DIR / "venv"
            subprocess.check_call([sys.executable, "-m", "venv", str(venv_path)])
            venv_python = find_venv_python()
            req_file = BACKEND_DIR / "requirements.txt"
            if venv_python and req_file.exists():
                print("[Auto-Venv] Installing backend requirements into virtualenv ...")
                pip_name = "pip.exe" if os.name == "nt" else "pip"
                pip_path = venv_python.parent / pip_name
                subprocess.check_call([str(pip_path), "install", "-r", str(req_file)])
        except Exception as e:
            print(f"[Auto-Venv] Setup notice: {e}")

    venv_python = find_venv_python() or Path(sys.executable)

    if reexec:
        # If current execution is not using the venv python, re-execute immediately
        try:
            if Path(sys.executable).resolve() != venv_python.resolve():
                print(f"\033[94m[Auto-Venv] Automatically activating virtualenv: {venv_python}\033[0m")
                if os.name == "nt":
                    code = subprocess.call([str(venv_python), str(Path(__file__).resolve())] + sys.argv[1:])
                    sys.exit(code)
                else:
                    os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve())] + sys.argv[1:])
        except Exception as e:
            print(f"[Auto-Venv] Notice: Continuing with current Python ({e})")

    return venv_python

VENV_PYTHON = find_venv_python() or Path(sys.executable)

def print_banner(text, color="\033[96m"):
    reset = "\033[0m"
    print(f"{color}{'=' * 65}\n  {text}\n{'=' * 65}{reset}")

def check_redis():
    print("[1/4] Checking Redis on port 6379...", end=" ", flush=True)
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect(("127.0.0.1", 6379))
        s.close()
        print("\033[92mONLINE (Port 6379 reachable)\033[0m")
        return True
    except Exception:
        print("\033[93mWARNING: Redis port 6379 is not reachable.\033[0m")
        print("      (FastAPI will use database fallback for OTPs if Redis is not running)")
        return False

def check_mongo():
    print("[2/4] Checking MongoDB connection...", end=" ", flush=True)
    try:
        import asyncio
        import motor.motor_asyncio
        from backend.app.config import settings

        async def ping_db():
            client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            res = await client.admin.command('ping')
            return res

        asyncio.run(ping_db())
        print("\033[92mCONNECTED\033[0m")
        return True
    except Exception as e:
        print(f"\033[93mWARNING: Mongo ping issue: {e}\033[0m")
        return False

def get_config():
    root_env = ROOT_DIR / ".env"
    frontend_port = 5173
    backend_port = 8000
    host = "0.0.0.0"

    if root_env.exists():
        for line in root_env.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            if line.startswith("FRONTEND_PORT=") or line.startswith("VITE_PORT="):
                val = line.split("=", 1)[1].strip()
                if val.isdigit():
                    frontend_port = int(val)
            elif line.startswith("BACKEND_PORT=") or line.startswith("PORT="):
                val = line.split("=", 1)[1].strip()
                if val.isdigit():
                    backend_port = int(val)
            elif line.startswith("HOST=") or line.startswith("BACKEND_HOST="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val:
                    host = val
    return frontend_port, backend_port, host

def wait_for_backend(port, timeout=12):
    """Actively verify backend responds on HTTP before proceeding."""
    import urllib.request
    test_url = f"http://127.0.0.1:{port}/"
    start_time = time.time()
    print(f"      Pinging FastAPI at {test_url} ...", end=" ", flush=True)
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(test_url, headers={"User-Agent": "HRMS-Launcher"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status in (200, 404):
                    print("\033[92mREADY (HTTP 200)\033[0m")
                    return True
        except Exception:
            time.sleep(0.5)
    print("\033[93mTIMED OUT\033[0m")
    return False

def free_ports(*ports):
    """Free up listening ports on both Windows and Linux/Ubuntu."""
    for port in ports:
        if not port:
            continue
        if os.name == "nt":
            # Pass 1: netstat -ano & taskkill with process tree (/T)
            try:
                out = subprocess.check_output(f'netstat -ano | findstr :{port}', shell=True, text=True, stderr=subprocess.DEVNULL)
                for line in out.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 5 and "LISTENING" in parts:
                        pid = parts[-1]
                        if pid.isdigit() and int(pid) != os.getpid():
                            subprocess.call(["taskkill", "/F", "/T", "/PID", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

            # Pass 2: PowerShell Get-NetTCPConnection with tree kill
            try:
                ps_cmd = f'Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ $pid = $_.OwningProcess; taskkill /F /T /PID $pid; Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }}'
                subprocess.call(["powershell", "-NoProfile", "-Command", ps_cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
        else:
            # Linux / Ubuntu / macOS
            # 1. fuser
            try:
                subprocess.call(["fuser", "-k", f"{port}/tcp"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
            # 2. lsof + kill
            try:
                subprocess.call(f"lsof -ti :{port} | xargs -r kill -9 2>/dev/null", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
            # 3. ss fallback
            try:
                subprocess.call(f"kill -9 $(ss -lptn 'sport = :{port}' | grep -oP 'pid=\\K[0-9]+') 2>/dev/null", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

def main():
    global VENV_PYTHON
    VENV_PYTHON = ensure_venv(reexec=True)
    os.system("color" if os.name == "nt" else "")
    print_banner(f"NEW-HRMS FULLSTACK LAUNCHER ({'UBUNTU/LINUX' if os.name != 'nt' else 'WINDOWS'})")

    check_redis()
    check_mongo()

    frontend_port, backend_port, host = get_config()

    # Pre-clean: ensure ports are free before starting
    free_ports(backend_port, frontend_port)

    processes = []
    popen_kwargs = {}
    if os.name != "nt":
        popen_kwargs["preexec_fn"] = os.setsid

    backend_env = {**os.environ, "PYTHONUNBUFFERED": "1"}

    try:
        # Start Backend
        display_host = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
        print(f"[3/4] Starting FastAPI Backend on http://{display_host}:{backend_port} (bound to {host}) ...")
        backend_cmd = [
            str(VENV_PYTHON),
            "-m", "uvicorn",
            "app.main:app",
            "--app-dir", str(BACKEND_DIR),
            "--host", host,
            "--port", str(backend_port),
            "--reload"
        ]
        backend_proc = subprocess.Popen(backend_cmd, cwd=str(ROOT_DIR), env=backend_env, **popen_kwargs)
        processes.append(backend_proc)

        # Health check backend
        backend_ready = wait_for_backend(backend_port, timeout=12)
        if backend_proc.poll() is not None:
            print(f"\033[91m[CRITICAL] Backend crashed immediately with exit code {backend_proc.returncode}!\033[0m")
            return

        # Start Frontend (Production Preview)
        print(f"[4/4] Starting Frontend (npm run preview) on port {frontend_port} ...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        frontend_cmd = [npm_cmd, "run", "preview"]
        frontend_proc = subprocess.Popen(frontend_cmd, cwd=str(FRONTEND_DIR), **popen_kwargs)
        processes.append(frontend_proc)

        print("\n\033[92m" + "=" * 65)
        print("  HRMS Fullstack is up and running!")
        print(f"  - Frontend:      http://{display_host}:{frontend_port}")
        print(f"  - Backend API:   http://{display_host}:{backend_port}")
        print(f"  - Swagger Docs:  http://{display_host}:{backend_port}/docs")
        print(f"  - Redis Test:    http://{display_host}:{backend_port}/test-redis")
        print(f"  - Mongo Test:    http://{display_host}:{backend_port}/test-mongo")
        print("=" * 65 + "\033[0m")
        print("\nPress Ctrl+C to stop all servers.\n")

        # Keep running and monitor
        while True:
            for proc in processes:
                code = proc.poll()
                if code is not None:
                    pname = "FastAPI Backend" if proc == backend_proc else "Frontend Server"
                    print(f"\n\033[91m[SHUTDOWN] {pname} terminated with exit code {code}.\033[0m")
                    return
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\033[93mShutting down servers and freeing ports...\033[0m")
    finally:
        for proc in processes:
            if proc.poll() is None:
                if os.name == "nt":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                        time.sleep(0.5)
                        if proc.poll() is None:
                            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except Exception:
                        try:
                            proc.kill()
                        except Exception:
                            pass

        # Guarantee all child/worker processes on ports are stopped
        free_ports(backend_port, frontend_port)
        print("\033[92mAll servers stopped and all ports freed cleanly.\033[0m")

if __name__ == "__main__":
    main()
