# ECOM ICS Local Agent v3.0 — Windows Installer

Phase 3 packages the ECOM ICS Local Agent as a normal Windows installer.

## What the installer does
- Installs the Local Agent into Program Files.
- Includes its own Node.js runtime, so Node.js does not need to be installed separately.
- Installs the `xlsx-js-style` dependency as part of the build.
- Registers the Local Agent to start automatically when the current Windows user signs in.
- Runs the agent hidden in the background at `http://127.0.0.1:3011`.
- Includes an uninstaller that removes the application and its auto-start entry.

## User experience
1. Run `ECOM-ICS-Local-Agent-Setup.exe`.
2. Finish installation.
3. The Local Agent starts automatically.
4. Open the public ECOM ICS website.
5. The website should show `LOCAL AGENT: CONNECTED`.

## Important
The agent still reads only these folders on the PC:
- `%USERPROFILE%\\Desktop\\Scanner`
- `%USERPROFILE%\\Desktop\\BXI`

The installer does not upload Scanner or BXI files anywhere.
