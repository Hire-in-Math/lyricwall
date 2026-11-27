# Plays a sound with Windows media controls turned on, so the reader has something to find on CI.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Playback.MediaPlayer, Windows.Media.Playback, ContentType = WindowsRuntime]
$null = [Windows.Media.Core.MediaSource, Windows.Media.Core, ContentType = WindowsRuntime]
$wav = Get-ChildItem C:\Windows\Media\*.wav | Sort-Object Length -Descending | Select-Object -First 1
Write-Output "playing $($wav.FullName)"
$p = [Windows.Media.Playback.MediaPlayer]::new()
$p.IsLoopingEnabled = $true
$p.Source = [Windows.Media.Core.MediaSource]::CreateFromUri([Uri]$wav.FullName)
$u = $p.SystemMediaTransportControls.DisplayUpdater
$u.Type = [Windows.Media.MediaPlaybackType]::Music
$u.MusicProperties.Title = 'Flashing Lights'
$u.MusicProperties.Artist = 'Kanye West'
$u.MusicProperties.AlbumTitle = 'Graduation'
$u.Update()
$p.Play()
Start-Sleep -Seconds 40
