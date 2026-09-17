const $ = id => document.getElementById(id);

function setStatus(text, cls = "") {
  $("status").textContent = text;
  $("status").className = "status " + cls;
}

async function runPairing() {
  const store = $("store").value;
  const sto = $("sto").value.trim().replace(/^STO#\s*/i, "");

  if (!store) {
    setStatus("Please select a STORE.", "err");
    return;
  }

  // No backslash regex is used here.
  if (!/^[0-9]+$/.test(sto)) {
    setStatus("Please enter a valid STO#.", "err");
    return;
  }

  $("run").disabled = true;
  $("files").textContent = "";
  $("meta").textContent = "";
  setStatus("Searching Desktop\\Scanner and Desktop\\BXI…", "busy");

  try {
    const response = await fetch("/pair", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({store, sto})
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({error: "Pairing failed."}));
      throw new Error(error.error || "Pairing failed.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = store + "_STO#" + sto + ".xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    $("files").textContent =
      "Scanner: " + decodeURIComponent(response.headers.get("X-Scanner-File") || "") +
      "\nBXI: " + decodeURIComponent(response.headers.get("X-BXI-File") || "");

    $("meta").textContent =
      decodeURIComponent(response.headers.get("X-Pairing-Summary") || "");

    setStatus("Pairing complete.\n" + store + "_STO#" + sto + ".xlsx downloaded.", "ok");
  } catch (error) {
    setStatus(error.message || "Pairing failed.", "err");
  } finally {
    $("run").disabled = false;
  }
}

$("run").addEventListener("click", runPairing);
$("sto").addEventListener("keydown", event => {
  if (event.key === "Enter") runPairing();
});
