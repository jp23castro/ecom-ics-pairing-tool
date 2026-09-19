Option Explicit

Dim shell, fso, folder, nodeExe
Dim wmi, processes, proc, commandLine

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = folder & "\runtime\node.exe"

' Stop only an existing ECOM ICS Local Agent process.
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set processes = wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='node.exe'")

For Each proc In processes
    commandLine = LCase("" & proc.CommandLine)

    If InStr(commandLine, LCase(folder & "\server.js")) > 0 Then
        proc.Terminate
    End If
Next

On Error GoTo 0

' Give the old process a moment to release port 3011.
WScript.Sleep 1000

' Start the bundled Node runtime with the installed server.js.
shell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & folder & "\server.js" & Chr(34), 0, False
