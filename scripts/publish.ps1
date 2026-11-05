param(
  [string]$RepositoryName = "football-file-upload"
)

$ErrorActionPreference = "Stop"
$description = "A football-inspired, gamified file upload interaction built with vanilla HTML, CSS, and JavaScript."
$topics = @(
  "file-upload",
  "gamification",
  "interaction-design",
  "creative-coding",
  "vanilla-javascript",
  "canvas",
  "html5",
  "football-game",
  "open-source"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required. Install it from https://cli.github.com/ and run 'gh auth login'."
}

& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "GitHub CLI is not authenticated. Run 'gh auth login' and retry."
}

& git rev-parse --show-toplevel *> $null
if ($LASTEXITCODE -ne 0) {
  & git init -b main
  if ($LASTEXITCODE -ne 0) { throw "Could not initialize Git repository." }
}

& git branch -M main
if ($LASTEXITCODE -ne 0) { throw "Could not set the main branch." }

& git rev-parse --verify HEAD *> $null
$hasCommit = $LASTEXITCODE -eq 0
$workingTree = git status --porcelain
if (-not $hasCommit -or $workingTree) {
  & git add -A
  if ($LASTEXITCODE -ne 0) { throw "Could not stage project files." }
  & git commit -m "Initial release"
  if ($LASTEXITCODE -ne 0) { throw "Could not create the initial commit. Configure git user.name and git user.email, then retry." }
}

$owner = (& gh api user --jq .login).Trim()
if (-not $owner) { throw "Could not determine the authenticated GitHub account." }
$fullName = "$owner/$RepositoryName"
$remoteUrl = "https://github.com/$fullName.git"

& gh repo view $fullName --json name *> $null
$repositoryExists = $LASTEXITCODE -eq 0
if (-not $repositoryExists) {
  & git remote get-url origin *> $null
  if ($LASTEXITCODE -eq 0) {
    & git remote rename origin previous-origin
    if ($LASTEXITCODE -ne 0) { throw "Could not preserve the existing origin remote." }
  }
  & gh repo create $fullName --public --source . --push --description $description
  if ($LASTEXITCODE -ne 0) { throw "Could not create and push the public repository." }
} else {
  & git remote get-url origin *> $null
  if ($LASTEXITCODE -eq 0) {
    & git remote set-url origin $remoteUrl
  } else {
    & git remote add origin $remoteUrl
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not configure the origin remote." }
  & git push -u origin main
  if ($LASTEXITCODE -ne 0) { throw "Could not push to the existing repository. If it has a separate initial commit, fetch and merge that commit before retrying." }
}

& gh repo edit $fullName --description $description
if ($LASTEXITCODE -ne 0) { throw "Repository was pushed, but its description could not be set." }
foreach ($topic in $topics) {
  & gh repo edit $fullName --add-topic $topic
  if ($LASTEXITCODE -ne 0) { Write-Warning "Could not add topic: $topic" }
}

& gh api --method POST "repos/$fullName/pages" -f build_type=workflow *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "GitHub Pages configured. The deployment workflow will publish the demo after the next successful push."
} else {
  Write-Warning "The repository is published, but Pages could not be enabled automatically. Enable Settings > Pages > GitHub Actions."
}

Write-Host ""
Write-Host "Published: https://github.com/$fullName"
Write-Host "Next: export a 1280x640 PNG from assets/social-preview.svg and upload it in Settings > General > Social preview."
