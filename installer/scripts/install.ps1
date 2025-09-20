$basePath = "C:\dua-data"

# Child folders
$folders = @(
    "$basePath\config",
    "$basePath\reports",
    "$basePath\logs",
    "$basePath\sheets",
    "$basePath\temp"
)

foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
        Write-Host "Created folder: $folder"
    }
}

# Create empty config.json and user-input.json if they don't exist
$configFile = "$basePath\config\config.json"
$userInputFile = "$basePath\config\user-input.json"

if (-not (Test-Path $configFile)) {
    '{}' | Set-Content $configFile
    Write-Host "Created empty config.json"
}

if (-not (Test-Path $userInputFile)) {
    '{}' | Set-Content $userInputFile
    Write-Host "Created empty user-input.json"
}
