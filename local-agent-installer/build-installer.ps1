$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$staging = Join-Path $root 'staging'
$runtime = Join-Path $staging 'runtime'
$nodeVersion = '24.19.0'
$nodeZip = Join-Path $root "node-v$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"

Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $runtime | Out-Null

Write-Host "Downloading Node.js $nodeVersion..."
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip

$temp = Join-Path $root 'node-temp'
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $nodeZip -DestinationPath $temp -Force
Copy-Item (Join-Path $temp "node-v$nodeVersion-win-x64\\node.exe") $runtime -Force

Copy-Item (Join-Path $root 'server.js') $staging -Force
Copy-Item (Join-Path $root 'package.json') $staging -Force
Copy-Item (Join-Path $root 'launch-agent.vbs') $staging -Force

Push-Location $staging
try {
    & $runtime\node.exe --version
    & $runtime\node.exe -e "console.log('Bundled Node runtime OK')"
    & npm install --omit=dev --ignore-scripts
}
finally {
    Pop-Location
}

Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue

Write-Host "Staging prepared. Compile ECOM-ICS-Local-Agent.iss with Inno Setup 6."
