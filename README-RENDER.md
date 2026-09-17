# ECOM ICS Pairing Tool — Render Phase 1

This package is the Phase 1 Render deployment version of the ECOM ICS Pairing Tool.

## Phase 1 goal
Put the website online so it can be opened from other PCs.

## Important
The current `/pair` implementation still reads:
- Desktop\Scanner
- Desktop\BXI

That local-PC file access is intentionally NOT treated as the cloud solution. Phase 2 will add the local agent so each PC can securely provide its own local files to the online website.

## Deploy to Render

1. Create a GitHub repository named `ecom-ics-pairing-tool`.
2. Upload the contents of this folder to that repository.
3. In Render, choose **New → Web Service**.
4. Connect the GitHub repository.
5. Use:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free
6. Deploy.
7. Open the public `https://....onrender.com` URL.
8. Test `/health` first. It should return JSON with `ok: true`.

## Local test
Run:
npm install
npm start

The server uses:
- `process.env.PORT` when provided by Render
- `0.0.0.0` for cloud binding
- port `10000` locally when no PORT is supplied


## Phase 2 — Local Agent

The public website no longer reads the Render server's Desktop. The browser sends pairing requests to the ECOM ICS Local Agent running on the same Windows PC at `http://127.0.0.1:3011`.

Deploy this updated project after the Local Agent package is installed on a test PC.
