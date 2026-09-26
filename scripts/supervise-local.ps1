$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtime = Join-Path $projectRoot '.local/runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
"$([DateTime]::UtcNow.ToString('o')) SUPERVISOR_START pid=$PID" | Add-Content -LiteralPath (Join-Path $runtime 'supervisor.log')
$mutex = [Threading.Mutex]::new($false, 'Local\MatchScoreRuntime')
try { $acquired = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired = $true }
if (-not $acquired) { $mutex.Dispose(); exit }
$node = (Get-Command node).Source
$children = @{}
try {
  while ($true) {
    try {
      $pg = Join-Path $projectRoot '.local/postgres/package/native/bin/pg_ctl.exe'
      $data = Join-Path $projectRoot '.local/postgres/data'
      if (Test-Path -LiteralPath $pg) {
        # Windows PowerShell treats native stderr warnings as errors under Stop.
        # pg_ctl can emit such a warning during normal recovery after a power loss.
        try {
          $ErrorActionPreference = 'Continue'
          & $pg -D $data status 2>&1 | Out-Null
          if ($LASTEXITCODE -ne 0) {
            & $pg -D $data -l (Join-Path $projectRoot '.local/postgres/server.log') -o '-p 55432 -h 127.0.0.1' -w -t 60 start 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup not ready; retrying on the next supervisor pass.' }
          }
        } finally { $ErrorActionPreference = 'Stop' }
      }
      $commands = @{
        web = @('node_modules/next/dist/bin/next', 'start')
        worker = @('--env-file-if-exists=.env', '--conditions=react-server', '--import', 'tsx', 'scripts/football-worker.ts')
      }
      foreach ($name in $commands.Keys) {
        if (-not $children.ContainsKey($name) -or $children[$name].HasExited) {
          $children[$name] = Start-Process -FilePath $node -ArgumentList $commands[$name] -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime "$name.log") -RedirectStandardError (Join-Path $runtime "$name.error.log")
          "$([DateTime]::UtcNow.ToString('o')) CHILD_STARTED name=$name pid=$($children[$name].Id)" | Add-Content -LiteralPath (Join-Path $runtime 'supervisor.log')
        }
      }
      $statePath = Join-Path $runtime 'supervisor.json'
      $temporaryState = Join-Path $runtime 'supervisor.tmp'
      @{ checkedAt = [DateTime]::UtcNow.ToString('o'); web = $children.web.Id; worker = $children.worker.Id } | ConvertTo-Json | Set-Content -LiteralPath $temporaryState
      Move-Item -LiteralPath $temporaryState -Destination $statePath -Force
    } catch {
      "$(Get-Date -Format o) $($_.Exception.Message)" | Add-Content -LiteralPath (Join-Path $runtime 'supervisor.error.log')
    }
    Start-Sleep -Seconds 30
  }
} finally {
  foreach ($child in $children.Values) { if (-not $child.HasExited) { Stop-Process -Id $child.Id -ErrorAction SilentlyContinue } }
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
