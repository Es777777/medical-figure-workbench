@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "BACKEND_HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "BACKEND_URL=http://%BACKEND_HOST%:%BACKEND_PORT%/healthz"
set "FRONTEND_URL=http://%BACKEND_HOST%:%FRONTEND_PORT%"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found in PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found in PATH.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Could not find frontend\package.json.
  pause
  exit /b 1
)

echo Checking whether backend is already running...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%BACKEND_URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo Starting backend on %BACKEND_HOST%:%BACKEND_PORT% ...
  start "OCR SVG Builder Backend" cmd /k "cd /d "%ROOT_DIR%" && python -m pip install --disable-pip-version-check --quiet fastapi uvicorn pillow >nul 2>nul && python -m uvicorn python.backend.main:app --host %BACKEND_HOST% --port %BACKEND_PORT% --reload"
) else (
  echo Backend already reachable at %BACKEND_URL%
)

echo Waiting for backend health check...
set "BACKEND_READY="
for /L %%I in (1,1,25) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%BACKEND_URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "BACKEND_READY=1"
    goto backend_ready
  )
  timeout /t 1 /nobreak >nul
)

:backend_ready
if not defined BACKEND_READY (
  echo Backend did not become ready in time.
  echo Check the backend window for errors.
  pause
  exit /b 1
)

echo Installing frontend dependencies if needed...
if not exist "%FRONTEND_DIR%\node_modules" (
  call npm --prefix "%FRONTEND_DIR%" install
  if errorlevel 1 (
    echo Frontend dependency installation failed.
    pause
    exit /b 1
  )
)

echo Checking whether frontend is already running...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%FRONTEND_URL%' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo Starting frontend on %BACKEND_HOST%:%FRONTEND_PORT% ...
  start "OCR SVG Builder Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && set "VITE_API_BASE_URL=http://%BACKEND_HOST%:%BACKEND_PORT%" && npm run dev -- --host %BACKEND_HOST% --port %FRONTEND_PORT%"
) else (
  echo Frontend already reachable at %FRONTEND_URL%
)

echo Waiting for frontend page...
set "FRONTEND_READY="
for /L %%I in (1,1,35) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%FRONTEND_URL%' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "FRONTEND_READY=1"
    goto frontend_ready
  )
  timeout /t 1 /nobreak >nul
)

:frontend_ready
if not defined FRONTEND_READY (
  echo Frontend did not become ready in time.
  echo Check the frontend window for errors.
  pause
  exit /b 1
)

echo Opening browser...
start "" "%FRONTEND_URL%"

echo.
echo Backend URL:  %BACKEND_URL%
echo Frontend URL: %FRONTEND_URL%
echo Everything is reachable now.
exit /b 0
