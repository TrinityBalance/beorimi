param(
    [string]$OutputDirectory = ".aws-build"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
$repositoryPrefix = $repositoryRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $buildRoot.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output must stay inside the repository: $buildRoot"
}

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $buildRoot | Out-Null

$backendRoot = Join-Path $repositoryRoot "backend"
$packageRoot = Join-Path $buildRoot "backend-package"
New-Item -ItemType Directory -Path $packageRoot | Out-Null

python -m pip install `
    --disable-pip-version-check `
    --no-warn-conflicts `
    --quiet `
    --platform manylinux2014_x86_64 `
    --implementation cp `
    --python-version 3.12 `
    --abi cp312 `
    --only-binary=:all: `
    --target $packageRoot `
    -r (Join-Path $backendRoot "requirements.txt")

if ($LASTEXITCODE -ne 0) {
    throw "Backend dependency packaging failed"
}

Copy-Item -LiteralPath (Join-Path $backendRoot "app") -Destination (Join-Path $packageRoot "app") -Recurse
Get-ChildItem -LiteralPath $packageRoot -Directory -Recurse -Filter "__pycache__" |
    Remove-Item -Recurse -Force

$archivePath = Join-Path $buildRoot "backend.zip"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packagePrefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$archive = [System.IO.Compression.ZipFile]::Open(
    $archivePath,
    [System.IO.Compression.ZipArchiveMode]::Create
)
try {
    foreach ($file in Get-ChildItem -LiteralPath $packageRoot -File -Recurse) {
        $entryName = $file.FullName.Substring($packagePrefix.Length).Replace("\", "/")
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
    $invalidEntries = @($entryNames | Where-Object { $_.Contains("\") })
    if ($invalidEntries.Count -gt 0) {
        throw "Backend archive contains Windows path separators"
    }
    foreach ($requiredEntry in @("app/main.py", "app/workers/analysis.py")) {
        if ($requiredEntry -notin $entryNames) {
            throw "Backend archive is missing required entry: $requiredEntry"
        }
    }
}
finally {
    $archive.Dispose()
}

Write-Output $archivePath
