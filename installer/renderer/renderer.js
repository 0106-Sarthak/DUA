document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("app");

  root.innerHTML = `
    <h2>Enter Secret Key</h2>
    <input id="secretKey" placeholder="Enter secret key" />
    <div id="error" style="color:red;margin-top:5px"></div>
    <button id="verifyBtn">Verify & Install</button>
  `;

  const keyInput = document.getElementById("secretKey");
  const errorDiv = document.getElementById("error");
  const verifyBtn = document.getElementById("verifyBtn");

  verifyBtn.addEventListener("click", async () => {
    const secretKey = keyInput.value.trim();

    if (!secretKey) {
      errorDiv.textContent = "Please enter a secret key";
      keyInput.focus();
      return;
    }

    errorDiv.textContent = "";
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    try {
      // Verify key via API
      const res = await fetch("http://localhost:4000/users/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Verification failed");
      }

      console.log("User data:", data);

      // if already active user, just alert and close
      if (data.active) {
        alert("This user is already active. You can close this window.");
        window.close();
        return;
      }

      const userID = data.user_id;
      const dealerName = data.dealer_name;
      console.log("Verification successful. UserID:", userID);

      // Run installer script via IPC (folders created + config written)
      verifyBtn.textContent = "Installing...";
      const out = await window.electronAPI.runInstall(userID, dealerName);
      console.log("Installation output:", out);

      alert(`Installation completed for user: ${userID}`);
      window.close();
    } catch (err) {
      console.error("Verification/Install failed:", err);
      errorDiv.textContent = "Error: " + err.message;
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify & Install";
    }
  });
});
