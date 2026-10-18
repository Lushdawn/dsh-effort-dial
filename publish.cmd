@echo off
chcp 65001 >nul
cd /d "H:\deepseek workspace\codex-effort-box\plugin"
echo ==== Effort Dial: npm publish ====
echo 如果提示 Enter OTP，请输入 6 位验证码后回车。
npm publish --access public
echo.
echo ==== 结束（ExitCode %ERRORLEVEL%），这个窗口可以关闭 ====
pause
