$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'supervise-local.ps1'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"'
$shell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$action = New-ScheduledTaskAction -Execute $shell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$recovery = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
try {
  Register-ScheduledTask -TaskName 'MatchScoreRuntime' -Action $action -Trigger @($trigger, $recovery) -Settings $settings -Description 'MatchScore local production and football synchronization' -Force | Out-Null
  Write-Output 'Scheduled task MatchScoreRuntime installed (logon and recovery every 5 minutes).'
  Start-ScheduledTask -TaskName 'MatchScoreRuntime'
} catch {
  $startup = [Environment]::GetFolderPath('Startup')
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'MatchScoreRuntime.lnk'))
  $shortcut.TargetPath = $shell
  $shortcut.Arguments = $arguments
  $shortcut.WorkingDirectory = Split-Path -Parent $PSScriptRoot
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Output 'Scheduled task unavailable; current-user Startup shortcut installed (at user logon).'
  Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden
}
