Add-Type -AssemblyName System.Windows.Forms
$chrome = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle }
if ($chrome) {
    $wshell = New-Object -ComObject wscript.shell
    $wshell.AppActivate($chrome.Id) | Out-Null
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^l')
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('^c')
    Start-Sleep -Milliseconds 100
    $url = Get-Clipboard
    Write-Output $url
} 