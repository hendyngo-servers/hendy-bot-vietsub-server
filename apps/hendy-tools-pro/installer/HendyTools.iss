#define AppName "Hendy Tools Pro"
#define AppVersion "0.1.0"
[Setup]
AppId={{58F05FC2-6F5F-4D2C-B768-0B5DFF239A1C}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\Hendy Tools Pro
DefaultGroupName=Hendy Tools Pro
OutputBaseFilename=HendyToolsPro-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
[Files]
; Add packaged executable files here after the Windows build pipeline is wired.
; Source: "..\dist\HendyToolsPro.exe"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\Hendy Tools Pro"; Filename: "{app}\HendyToolsPro.exe"
