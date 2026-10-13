@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto neednode
where npm >nul 2>nul
if errorlevel 1 goto neednode
echo Installing the app dependencies...
call npm ci
if errorlevel 1 goto failed
call npm run typecheck
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
set "EAS_NO_VCS=1"
echo Sign into the molious Expo account using the device link below.
call npx --yes eas-cli@24.12.1 login --device
if errorlevel 1 goto failed
echo Submitting Laura's Linguistics Android APK build...
call npx --yes eas-cli@24.12.1 build --platform android --profile preview
if errorlevel 1 goto failed
echo Follow the Expo build link above to download the APK after it succeeds.
pause
exit /b 0
:neednode
echo Install Node.js LTS from https://nodejs.org/ then reopen this file.
pause
exit /b 1
:failed
echo The last step failed. Keep this window open and share the error text.
pause
exit /b 1
