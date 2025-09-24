param(
    [string]$AppPath
)

Write-Host "Running install.ps1..."
Write-Host "AppPath passed from Node: $AppPath"

if (-not (Test-Path $AppPath)) {
    Write-Host "ERROR: App source path does not exist: $AppPath"
    exit 1
}

# Base paths
$basePath = "C:\dua-data"
$binPath = Join-Path $basePath "bin"

# Child folders to create
$folders = @(
    "$basePath\config",
    "$basePath\reports",
    "$basePath\logs",
    "$basePath\sheets",
    "$basePath\temp",
    $binPath
)

# Create folders if they don't exist
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
        Write-Host "Created folder: $folder"
    }
}

# Create empty config.json and user-input.json if missing
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

# Copy Electron app from temp to bin
Write-Host "Copying app from $AppPath to $binPath"
Copy-Item -Path "$AppPath\*" -Destination $binPath -Recurse -Force

# Launch the installed app
$exePath = Join-Path $binPath "dua-app.exe"  # Make sure this matches your main exe
if (Test-Path $exePath) {
    Write-Host "Launching the app..."
    Start-Process -FilePath $exePath
} else {
    Write-Host "ERROR: App executable not found at: $exePath"
    exit 1
}

Write-Host "Installation completed successfully."
