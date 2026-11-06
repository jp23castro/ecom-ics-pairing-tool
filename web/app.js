
const $ = id => document.getElementById(id);
const AGENT_URL = "http://127.0.0.1:3012";

function setStatus(text, cls = "") {
  $("status").textContent = text;
  $("status").className = "status " + cls;
}

function setAgent(text, cls = "") {
  const el = $("agent-status");
  if (!el) return;
  el.textContent = text;
  el.className = "agent-status " + cls;
}

function decodeHeader(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

async function agentFetch(path, options = {}) {
  const request = new Request(AGENT_URL + path, {
    ...options,
    mode: "cors",
    targetAddressSpace: "loopback"
  });

  return fetch(request);
}

async function checkAgent() {
  try {
    const response = await agentFetch("/health", {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error("Local Agent returned HTTP " + response.status);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error("Local Agent is not ready.");
    }

    setAgent("LOCAL AGENT: CONNECTED", "agent-ok");
    return true;

  } catch (error) {
    setAgent("LOCAL AGENT: NOT CONNECTED", "agent-err");
    return false;
  }
}

async function runPairing() {
  const store = $("store").value;
  const sto = $("sto").value.trim().replace(/^STO#\s*/i, "");

  if (!store) {
    setStatus("Please select a STORE.", "err");
    return;
  }

  if (!/^[0-9]+$/.test(sto)) {
    setStatus("Please enter a valid STO#.", "err");
    return;
  }

  $("run").disabled = true;
  $("files").textContent = "";
  $("meta").textContent = "";

  setStatus("Connecting to the ECOM ICS Local Agent...", "busy");
  setAgent("LOCAL AGENT: CONNECTING...", "agent-busy");

  try {
    const response = await agentFetch("/pair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ store, sto })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Pairing failed."
      }));

      throw new Error(error.error || "Pairing failed.");
    }

    // Read CSV information from Local Agent response headers.
    const csvFile = decodeHeader(
      response.headers.get("X-CSV-File")
    );

    const csvRows = response.headers.get("X-CSV-Rows") || "0";

    // Download the existing paired Excel report.
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = store + "_STO#" + sto + ".xlsx";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    // Display both output files and their statuses.
    $("files").textContent =
      "Scanner: " +
      decodeHeader(response.headers.get("X-Scanner-File")) +

      "\nBXI: " +
      decodeHeader(response.headers.get("X-BXI-File")) +

      "\nExcel: " +
      store + "_STO#" + sto + ".xlsx — Downloaded" +

      "\nCSV: " +
      (csvFile || "CSV filename unavailable") +
      " — Saved (" + csvRows + " rows)" +

      "\nCSV folder: C:\\Users\\Public\\Documents\\105 CSV";

    $("meta").textContent = decodeHeader(
      response.headers.get("X-Pairing-Summary")
    );

    setAgent("LOCAL AGENT: CONNECTED", "agent-ok");

    setStatus(
      "Pairing complete.\n" +
      store + "_STO#" + sto + ".xlsx downloaded.\n" +
      "Scanner CSV saved successfully.",
      "ok"
    );

  } catch (error) {
    setAgent("LOCAL AGENT: NOT CONNECTED", "agent-err");

    const message = String(error && error.message || "");

    if (/Failed to fetch|NetworkError|fetch/i.test(message)) {
      setStatus(
        "Cannot connect to Local Agent.\n" +
        "Check that the Local Agent is running and browser access is allowed.",
        "err"
      );
    } else {
      setStatus(message || "Pairing failed.", "err");
    }

  } finally {
    $("run").disabled = false;
  }
}

$("run").addEventListener("click", runPairing);

$("sto").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    runPairing();
  }
});

checkAgent();
setInterval(checkAgent, 10000);
