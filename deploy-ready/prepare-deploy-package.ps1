$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageDir = Join-Path $PSScriptRoot 'package'

if (Test-Path -LiteralPath $packageDir) {
    Remove-Item -LiteralPath $packageDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

$itemsToCopy = @(
    'app.js',
    'package.json',
    'package-lock.json',
    'api',
    'backend',
    'data',
    'docs',
    'frontend',
    'config',
    'admin_credentials.json',
    'permissions.json',
    'permissions-detailed.json',
    'date_sheet.json',
    '.htaccess',
    '.cpanel.yml',
    'render.yaml',
    'vercel.json',
    'ecosystem.config.js'
)

foreach ($item in $itemsToCopy) {
    $source = Join-Path $projectRoot $item
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination $packageDir -Recurse -Force
    } else {
        Write-Warning "Missing: $item"
    }
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README_URDU.md') -Destination (Join-Path $packageDir 'DEPLOY_README_URDU.md') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'env.production.template') -Destination (Join-Path $packageDir '.env.example') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server-commands.sh') -Destination (Join-Path $packageDir 'server-commands.sh') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'cpanel-nodejs-notes.md') -Destination (Join-Path $packageDir 'CPANEL_NODEJS_NOTES.md') -Force

Write-Host "Deploy package prepared at: $packageDir"
Write-Host "Upload everything inside deploy-ready/package to your server project root."
