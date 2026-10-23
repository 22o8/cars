Option Explicit
Dim shell, fso, base, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = Chr(34) & base & "\.venv\Scripts\pythonw.exe" & Chr(34) & " " & Chr(34) & base & "\watchdog.py" & Chr(34)
shell.Run cmd, 0, False
