Option Explicit
Dim shell, fso, folder, nodeExe, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = folder & "\runtime\node.exe"
cmd = """" & nodeExe & """ """" & folder & "\server.js""""
shell.Run cmd, 0, False
