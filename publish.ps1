# Publish Effort Dial to npm and push the git repository.
# Run from this directory (the package root).
#
# npm: this account has 2FA enabled, so npm asks for a one-time password
# (or an automation token in ~/.npmrc). Run it in a real terminal.
#
#   .\publish.ps1            # npm publish (prompts for OTP), then git push
#   .\publish.ps1 -SkipNpm   # only push the git repository
#
param([switch]$SkipNpm, [string]$Otp)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not $SkipNpm) {
  if ($Otp) { npm publish --access public --otp=$Otp }
  else { npm publish --access public }
  if ($LASTEXITCODE -ne 0) { throw "npm publish failed ($LASTEXITCODE)" }
}

git push -u origin master
if ($LASTEXITCODE -ne 0) { throw "git push failed ($LASTEXITCODE) - create github.com/Lushdawn/dsh-effort-dial first" }
Write-Host "done: https://www.npmjs.com/package/dsh-effort-dial"
