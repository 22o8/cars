Option Explicit
Dim shell, fso, base, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = Chr(34) & base & "\start-agent-silent.bat" & Chr(34)
shell.Run cmd, 0, False
