param(
    [string]$Output = "hosting-upload.zip",
    [switch]$IncludeNodeModules
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputPath = Join-Path $projectRoot $Output

if (Test-Path $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

$excludePrefixes = @(
    ".git\",
    ".git/",
    ".vscode\",
    ".vscode/",
    "node_modules\",
    "node_modules/"
)

if ($IncludeNodeModules) {
    $excludePrefixes = $excludePrefixes | Where-Object { $_ -notlike "node_modules*" }
}

$allFiles = Get-ChildItem -Path $projectRoot -Recurse -File -Force
$filesToPack = $allFiles | Where-Object {
    $relative = $_.FullName.Substring($projectRoot.Length).TrimStart('\', '/')
    foreach ($prefix in $excludePrefixes) {
        if ($relative.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }

    if ($relative -eq $Output) { return $false }
    return $true
}

if (-not $filesToPack) {
    throw "No files selected for archive."
}

$tempDir = Join-Path $projectRoot ".deploy_tmp"
if (Test-Path $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

foreach ($file in $filesToPack) {
    $relative = $file.FullName.Substring($projectRoot.Length).TrimStart('\', '/')
    $target = Join-Path $tempDir $relative
    $targetDir = Split-Path -Parent $target
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $file.FullName -Destination $target
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $outputPath -Force
Remove-Item -LiteralPath $tempDir -Recurse -Force

Write-Output "Created: $outputPath"
Write-Output "Include node_modules: $($IncludeNodeModules.IsPresent)"
