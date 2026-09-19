#define MyAppName "ECOM ICS Local Agent"
#define MyAppVersion "3.0.0-win7"
#define MyAppPublisher "ECOM ICS"

[Setup]
AppId={{E4C4E2B7-7C61-4E0D-9C2D-ECOMICSWIN7}}
AppName={#MyAppName} (Windows 7)
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\ECOM ICS Local Agent
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=ECOM-ICS-Local-Agent-Windows7-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
MinVersion=6.1sp1
ArchitecturesAllowed=x86 x64
UninstallDisplayName=ECOM ICS Local Agent (Windows 7)

[Files]
Source: "win7-staging\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "win7-staging\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "win7-staging\launch-agent.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "win7-staging\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "win7-staging\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "ECOM ICS Local Agent"; ValueData: """{sys}\wscript.exe"" ""{app}\launch-agent.vbs"""; Flags: uninsdeletevalue

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\runtime"
Type: files; Name: "{app}\server.js"
Type: files; Name: "{app}\package.json"
Type: files; Name: "{app}\launch-agent.vbs"
