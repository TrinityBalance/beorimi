param(
    [string]$OutputDirectory = ".aws-build"
)

$ErrorActionPreference = "Stop"

$archiveRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$buildRoot = [System.IO.Path]::GetFullPath((Join-Path $archiveRoot $OutputDirectory))
$archivePrefix = $archiveRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $buildRoot.StartsWith($archivePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output must stay inside the AWS archive: $buildRoot"
}

if (-not (Test-Path -LiteralPath $buildRoot)) {
    New-Item -ItemType Directory -Path $buildRoot | Out-Null
}

$vlmRoot = Join-Path $repositoryRoot "vlm"
$packageRoot = Join-Path $buildRoot "vlm-package"
if (Test-Path -LiteralPath $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
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
    -r (Join-Path $vlmRoot "requirements.txt")

if ($LASTEXITCODE -ne 0) {
    throw "VLM dependency packaging failed"
}

# AIDEV-NOTE: schemas 와 prompts 는 app/schemas.py 와 app/inference.py 가 VLM_ROOT 기준
#             상대 경로로 읽는다(VLM_ROOT = app 의 부모). zip 최상위에 app/ 과 나란히
#             두어야 Lambda 의 /var/task 에서 같은 구조가 된다.
Copy-Item -LiteralPath (Join-Path $vlmRoot "app") -Destination (Join-Path $packageRoot "app") -Recurse
Copy-Item -LiteralPath (Join-Path $vlmRoot "schemas") -Destination (Join-Path $packageRoot "schemas") -Recurse
Copy-Item -LiteralPath (Join-Path $vlmRoot "prompts") -Destination (Join-Path $packageRoot "prompts") -Recurse

Get-ChildItem -LiteralPath $packageRoot -Directory -Recurse -Filter "__pycache__" |
    Remove-Item -Recurse -Force

$archivePath = Join-Path $buildRoot "vlm.zip"
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}

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
        throw "VLM archive contains Windows path separators"
    }
    $requiredEntries = @(
        "app/main.py",
        "app/api.py",
        "app/contracts.py",
        "schemas/observation-response.json",
        "prompts/waste_classifier.txt"
    )
    foreach ($requiredEntry in $requiredEntries) {
        if ($requiredEntry -notin $entryNames) {
            throw "VLM archive is missing required entry: $requiredEntry"
        }
    }
}
finally {
    $archive.Dispose()
}

Write-Output $archivePath
