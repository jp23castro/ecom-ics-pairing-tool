Option Explicit

Dim shell, fso, folder, nodeExe, cmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = folder & "\runtime\node.exe"

' Build: "C:\...\runtime\node.exe" "C:\...\server.js"
cmd = Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & folder & "\server.js" & Chr(34)

shell.Run cmd, 0, False
