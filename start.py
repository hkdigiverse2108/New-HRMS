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
                    try:
                        code = subprocess.call([str(venv_python), str(Path(__file__).resolve())] + sys.argv[1:])
                        sys.exit(code)
                    except KeyboardInterrupt:
                        sys.exit(0)
                else:
                    try:
                        os.execv(str(venv_python), [str(venv_python), str(Path(__file__).resolve())] + sys.argv[1:])
                    except Exception:
                        pass
        except KeyboardInterrupt:
            sys.exit(0)
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

def load_root_env():
    """Load all variables from root .env and set them in os.environ."""
    root_env = ROOT_DIR / ".env"
    env_dict = {}
    if root_env.exists():
        for line in root_env.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                env_dict[key] = val
                os.environ[key] = val
    return env_dict

def get_config():
    env_dict = load_root_env()
    frontend_port = 5173
    backend_port = 8000
    host = "0.0.0.0"
    vite_api_url = env_dict.get("VITE_API_URL", "").strip()

    f_val = env_dict.get("FRONTEND_PORT") or env_dict.get("VITE_PORT")
    if f_val and f_val.isdigit():
        frontend_port = int(f_val)

    b_val = env_dict.get("BACKEND_PORT") or env_dict.get("PORT")
    if b_val and b_val.isdigit():
        backend_port = int(b_val)

    h_val = env_dict.get("HOST") or env_dict.get("BACKEND_HOST")
    if h_val:
        host = h_val

    return frontend_port, backend_port, host, vite_api_url, env_dict

def sync_env_config(vite_api_url: str):
    """Write public/env-config.js and .vercel/output/static/env-config.js so frontend runtime has live VITE_API_URL."""
    if not vite_api_url:
        return
    script_content = f'window.__ENV__ = {{\n  VITE_API_URL: "{vite_api_url}"\n}};\n'
    try:
        public_dir = FRONTEND_DIR / "public"
        public_dir.mkdir(parents=True, exist_ok=True)
        (public_dir / "env-config.js").write_text(script_content, encoding="utf-8")

        static_dir = FRONTEND_DIR / ".vercel" / "output" / "static"
        if static_dir.exists():
            (static_dir / "env-config.js").write_text(script_content, encoding="utf-8")
    except Exception as e:
        print(f"[Notice] env-config sync: {e}")

def ensure_frontend_build(vite_api_url: str, force_rebuild: bool = False):
    """
    Check if Frontend needs to be built or rebuilt based on VITE_API_URL or missing dist.
    Prioritizes .env VITE_API_URL across both build-time and runtime.
    """
    dist_dir = FRONTEND_DIR / ".vercel" / "output"
    stamp_file = FRONTEND_DIR / ".last_build_api_url"

    last_built_url = stamp_file.read_text(encoding="utf-8").strip() if stamp_file.exists() else None

    needs_build = False
    reason = ""
    if not dist_dir.exists():
        needs_build = True
        reason = "Frontend build output (.vercel/output) not found."
    elif force_rebuild:
        needs_build = True
        reason = "Forced rebuild requested (--rebuild)."
    elif vite_api_url and last_built_url != vite_api_url:
        needs_build = True
        reason = f"VITE_API_URL in .env ('{vite_api_url}') differs from previous build ('{last_built_url}')."

    # Always ensure live runtime script is fresh
    sync_env_config(vite_api_url)

    if needs_build:
        print(f"\033[94m[4/4] {reason} Rebuilding Frontend bundle...\033[0m")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        build_env = {**os.environ, "VITE_API_URL": vite_api_url}
        subprocess.check_call([npm_cmd, "run", "build"], cwd=str(FRONTEND_DIR), env=build_env)
        stamp_file.write_text(vite_api_url, encoding="utf-8")
        sync_env_config(vite_api_url)
        print("\033[92m[4/4] Frontend bundle built successfully.\033[0m")
    else:
        print(f"\033[92m[4/4] Frontend bundle is up to date (API URL: {vite_api_url or 'default'}).\033[0m")

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

def is_port_in_use(port, host="127.0.0.1"):
    """Check if a TCP port is currently accepting connections."""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.3)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False

def free_ports(*ports):
    """Free up listening ports on both Windows and Linux/Ubuntu with retry verification."""
    for port in ports:
        if not port:
            continue
        for attempt in range(3):
            if not is_port_in_use(port):
                break
            if os.name == "nt":
                # Pass 1: netstat -ano & taskkill with process tree (/T)
                try:
                    out = subprocess.check_output(f'netstat -ano -p tcp | findstr :{port}', shell=True, text=True, stderr=subprocess.DEVNULL)
                    pids_to_kill = set()
                    for line in out.splitlines():
                        parts = line.strip().split()
                        if len(parts) >= 5 and "LISTENING" in parts:
                            local_addr = parts[1]
                            if local_addr.endswith(f":{port}"):
                                pid = parts[-1]
                                if pid.isdigit() and int(pid) != os.getpid() and int(pid) != 0:
                                    pids_to_kill.add(pid)
                    for pid in pids_to_kill:
                        subprocess.call(["taskkill", "/F", "/T", "/PID", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass

                # Pass 2: PowerShell Get-NetTCPConnection
                try:
                    ps_cmd = f'Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ $p = $_.OwningProcess; if ($p -and $p -ne 0 -and $p -ne {os.getpid()}) {{ Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }} }}'
                    subprocess.call(["powershell", "-NoProfile", "-Command", ps_cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
            else:
                # Linux / Ubuntu / macOS
                try:
                    subprocess.call(["fuser", "-k", f"{port}/tcp"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass
                try:
                    subprocess.call(f"lsof -ti :{port} | xargs -r kill -9 2>/dev/null", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception:
                    pass

            if is_port_in_use(port):
                time.sleep(0.3)

def main():
    global VENV_PYTHON
    try:
        VENV_PYTHON = ensure_venv(reexec=True)
    except KeyboardInterrupt:
        sys.exit(0)

    os.system("color" if os.name == "nt" else "")
    print_banner(f"NEW-HRMS FULLSTACK LAUNCHER ({'UBUNTU/LINUX' if os.name != 'nt' else 'WINDOWS'})")

    check_redis()
    check_mongo()

    frontend_port, backend_port, host, vite_api_url, env_dict = get_config()

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

        # Ensure Frontend is built and up to date with .env VITE_API_URL
        force_rebuild = "--rebuild" in sys.argv
        ensure_frontend_build(vite_api_url, force_rebuild=force_rebuild)

        # Start Frontend using node directly (completely eliminates cmd.exe and 'Terminate batch job (Y/N)?' prompt)
        print(f"[4/4] Starting Frontend on port {frontend_port} ...")
        frontend_cmd = ["node", "run-preview.mjs"]
        frontend_env = {**os.environ, "VITE_API_URL": vite_api_url, "FRONTEND_PORT": str(frontend_port)}
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            env=frontend_env,
            **popen_kwargs
        )
        processes.append(frontend_proc)

        print("\n\033[92m" + "=" * 65)
        print("  HRMS Fullstack is up and running!")
        print(f"  - Frontend:      http://{display_host}:{frontend_port}")
        print(f"  - Backend API:   http://{display_host}:{backend_port}")
        print(f"  - VITE_API_URL:  {vite_api_url or '(dynamic fallback)'}")
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
    try:
        main()
    except KeyboardInterrupt:
        try:
            f_port, b_port, *_ = get_config()
            free_ports(b_port, f_port)
        except Exception:
            pass
        sys.exit(0)
