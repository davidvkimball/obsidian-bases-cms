# Setup skills symlinks for Obsidian Sample Plugin Plus
# This script creates symlinks to the obsidian-dev-skills repository

param(
    [string]$SkillsRepoPath = "$PSScriptRoot\..\obsidian-dev-skills"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting up skills symlinks..." -ForegroundColor Cyan

# Check if skills repo exists
if (-not (Test-Path $SkillsRepoPath)) {
    Write-Host "Skills repository not found at: $SkillsRepoPath" -ForegroundColor Red
    Write-Host "Please clone obsidian-dev-skills to a sibling directory." -ForegroundColor Yellow
    Write-Host "Example: git clone https://github.com/davidvkimball/obsidian-dev-skills.git obsidian-dev-skills" -ForegroundColor Yellow
    exit 1
}

$skillsDir = "$PSScriptRoot\..\.agent\skills"

# Create skills directory if it doesn't exist
if (-not (Test-Path $skillsDir)) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
}

$skills = @("obsidian-dev", "obsidian-ops", "obsidian-ref")

foreach ($skill in $skills) {
    $targetPath = Join-Path $skillsDir $skill
    $sourcePath = Join-Path $SkillsRepoPath $skill

    # Remove existing symlink/directory if it exists
    if (Test-Path $targetPath) {
        $item = Get-Item $targetPath
        if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
            Remove-Item $targetPath -Force
        } else {
            Remove-Item $targetPath -Recurse -Force
        }
    }

    # Create symlink
    Write-Host "Creating symlink: $skill" -ForegroundColor Green
    cmd /c mklink /J "$targetPath" "$sourcePath" | Out-Null
}

Write-Host "Skills setup complete!" -ForegroundColor Cyan
Write-Host "The following skills are now available:" -ForegroundColor Gray
Write-Host "  - obsidian-dev (core development)" -ForegroundColor Gray
Write-Host "  - obsidian-ops (operations & workflows)" -ForegroundColor Gray
Write-Host "  - obsidian-ref (technical references)" -ForegroundColor Gray