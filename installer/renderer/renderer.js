document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');

  root.innerHTML = `
    <h2>Enter Secret Key</h2>
    <input id="secretKey" placeholder="Enter secret key" />
    <div id="error" style="color:red;margin-top:5px"></div>
    <button id="verifyBtn">Verify & Install</button>
  `;

  const keyInput = document.getElementById('secretKey');
  const errorDiv = document.getElementById('error');
  const verifyBtn = document.getElementById('verifyBtn');

  verifyBtn.addEventListener('click', async () => {
    const key = keyInput.value.trim();

    if (!key) {
      errorDiv.textContent = "Please enter a key";
      keyInput.focus();
      return;
    }

    errorDiv.textContent = "";

    if (key === "12345") {
      try {
        // show "installing..." feedback
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Installing...";

        const out = await window.electronAPI.runInstall();
        console.log("Install output:", out);

        alert("Installation completed. Installer will close now.");
        window.close();
      } catch (err) {
        console.error("Install failed:", err);
        errorDiv.textContent = "Install failed: " + err;
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Verify & Install";
      }
    } else {
      errorDiv.textContent = "Invalid key (use 12345 for testing)";
    }
  });
});
