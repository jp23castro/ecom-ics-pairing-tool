#define MyAppName "ECOM ICS Local Agent"
#define MyAppVersion "3.0.0"
#define MyPublisher "JP Castro"
#define MyAppURL "https://github.com/jp23castro/ecom-ics-pairing-tool"

[Setup]
AppId={{7F3D4F58-1F3B-4B8C-9E7B-ECOMICSLAGENT30}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\ECOM ICS Local Agent
DefaultGroupName=ECOM ICS Local Agent
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=ECOM-ICS-Local-Agent-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "staging\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Registry]
Root: HKCU; Subkey: "Software\\Microsoft\\Windows\\CurrentVersion\\Run"; ValueType: string; ValueName: "ECOM ICS Local Agent"; ValueData: "wscript.exe ""{app}\\launch-agent.vbs"""; Flags: uninsdeletevalue

[Icons]
Name: "{group}\\ECOM ICS Local Agent"; Filename: "{app}\\launch-agent.vbs"
Name: "{autodesktop}\\ECOM ICS Local Agent"; Filename: "{app}\\launch-agent.vbs"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Run]
Filename: "wscript.exe"; Parameters: """{app}\\launch-agent.vbs"""; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
