param(
  [Parameter(Mandatory = $false)]
  [string]$DatabaseUrl = $env:AIVEN_TEST_DATABASE_URL
)

$ErrorActionPreference = "Stop"

function Assert-ReconstructionUrl {
  param([string]$Url)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    throw "AIVEN_TEST_DATABASE_URL is required."
  }

  $parsed = [System.Uri]$Url
  if ($parsed.Host -notlike "*.aivencloud.com") {
    throw "Refusing to run: host is not an Aiven hostname."
  }

  $database = $parsed.AbsolutePath.TrimStart("/")
  if ($database -ne "proba_match_reconstruction_test") {
    throw "Refusing to run: database must be proba_match_reconstruction_test."
  }

  if ($parsed.Query -notmatch "(^|\?|&)sslmode=require(&|$)") {
    throw "Refusing to run: sslmode=require is mandatory."
  }
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Name =="
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Name"
  }
}

Assert-ReconstructionUrl $DatabaseUrl
$env:DATABASE_URL = $DatabaseUrl
$env:MIGRATION_WRITES_PAUSED = "true"

Invoke-Step "Install exact dependencies" { npm ci }
Invoke-Step "Generate Prisma client" { npm run db:generate }
Invoke-Step "Verify Aiven test database is empty" { node scripts/verify-reconstruction-target.mjs empty }

Write-Host ""
Write-Host "== Prisma migrate status before deploy =="
npx prisma migrate status

Invoke-Step "Apply Prisma migrations to Aiven test database" { npm run db:migrate }
Invoke-Step "Prisma migrate status after deploy" { npx prisma migrate status }
Invoke-Step "Verify reconstructed schema" { node scripts/verify-reconstruction-target.mjs schema }

Invoke-Step "Import OpenFootball history" { npm run football:import -- --force }
Invoke-Step "Import ESPN expanded history" { npm run football:expanded-import -- --force }

for ($i = 1; $i -le 8; $i++) {
  Invoke-Step "Import ESPN player batch $i" {
    node --env-file-if-exists=.env --conditions=react-server --import tsx scripts/football.ts expanded-players --limit=30
  }
}

for ($i = 1; $i -le 5; $i++) {
  Invoke-Step "Import TheSportsDB player batch $i" { npm run football:players -- --limit=30 }
}

Invoke-Step "Rebuild Elo" { npm run football:rebuild-elo }
Invoke-Step "Validate provider access" { npm run football:validate }
Invoke-Step "Validate relational football data" { npm run data:validate }
Invoke-Step "Measure reconstructed counts" { node scripts/verify-reconstruction-target.mjs counts }

Write-Host ""
Write-Host "Aiven reconstruction test finished. Do not switch Production until Preview, SEO and monitoring gates pass."
