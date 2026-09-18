# Phase 3 — GitHub build instructions

1. Create a folder in the repository named `local-agent-installer`.
2. Upload these files into that folder:
   - `server.js`
   - `package.json`
   - `launch-agent.vbs`
   - `ECOM-ICS-Local-Agent.iss`
   - `README.md`
   - `README-BUILD.md`
3. Create `.github/workflows/build-local-agent-installer.yml` using the included workflow file.
4. Commit to `main`.
5. GitHub Actions will build the Windows installer.
6. Open the repository's **Actions** tab and open **Build ECOM ICS Local Agent Installer**.
7. When the run is green, open it and download the artifact named `ECOM-ICS-Local-Agent-Setup`.
8. The artifact contains `ECOM-ICS-Local-Agent-Setup.exe`.

The installer bundles its own Node.js runtime and installs the agent to Program Files. It uses HKCU Run to start the agent automatically for the installing Windows user, avoiding the scheduled-task permission problem encountered in Phase 2.1.
