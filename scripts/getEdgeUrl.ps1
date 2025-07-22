Add-Type -AssemblyName System.Windows.Forms
$edge = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle }
if ($edge) {
    $wshell = New-Object -ComObject wscript.shell
    $wshell.AppActivate($edge.Id) | Out-Null
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('^l')
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('^c')
    Start-Sleep -Milliseconds 100
    $url = Get-Clipboard
    Write-Output $url
} 