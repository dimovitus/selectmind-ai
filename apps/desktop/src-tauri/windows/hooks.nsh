; Close a running instance before copying files — prevents locked-exe upgrades.
!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM selectmind-desktop.exe /T'
  Sleep 1500
!macroend
