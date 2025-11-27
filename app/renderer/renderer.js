document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("setup-form");
  const editButton = document.getElementById("edit-button");
  const saveButton = document.getElementById("save-button");
  const runButton = document.getElementById("run-button");

  const fields = ["userId", "password", "actPositions"].map((id) =>
    document.getElementById(id)
  );
  const sheetCheckboxes = Array.from(
    document.querySelectorAll("#sheet-options input[type=checkbox]")
  );

  function setFieldsEditable(editable) {
    fields.forEach((field) => (field.disabled = !editable));
    sheetCheckboxes.forEach((cb) => (cb.disabled = !editable));
    saveButton.style.display = editable ? "inline-block" : "none";
    editButton.style.display = editable ? "none" : "inline-block";
  }

  let previousRunSheets = [0]; // default

  try {
    const userInputs = await window.electronAPI.getUserInputs();
    const existingArray = userInputs["test-sheet"]?.inputs || [];
    const existing = existingArray[0] || {};

    // Pre-fill the form
    document.getElementById("userId").value = existing.userId || "";
    document.getElementById("password").value = existing.password || "";
    document.getElementById("actPositions").value = (
      existing.activePositions || []
    ).join(",");

    // Handle checkboxes
    previousRunSheets = existing.runSheets || [0]; // preserve previous selection or default 0
    sheetCheckboxes.forEach((cb) => {
      cb.checked = previousRunSheets.includes(Number(cb.value));
    });

    setFieldsEditable(existingArray.length === 0);
  } catch (error) {
    console.error("Error loading user inputs:", error);
    setFieldsEditable(true);
  }

  editButton.addEventListener("click", () => {
    setFieldsEditable(true);
  });

  runButton.addEventListener("click", async () => {
    try {
      const userInputs = await window.electronAPI.getUserInputs();
      await window.electronAPI.saveUserInputs(userInputs); // ensure 0 is added if needed
      alert("Running automation...");
    } catch (err) {
      console.error(err);
      alert("Automation failed.");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userId = document.getElementById("userId").value.trim();
    const password = document.getElementById("password").value.trim();
    const actPositions = document.getElementById("actPositions").value.trim();

    if (!userId || !password) {
      alert("Please fill all required fields.");
      return;
    }

    // Only overwrite runSheets if user actually changed selection
    let runSheets;
    const selectedSheets = sheetCheckboxes
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.value));
    runSheets = selectedSheets.length > 0 ? selectedSheets : previousRunSheets;

    if (!runSheets.includes(0)) runSheets.unshift(0);

    const userInputData = {
      "test-sheet": {
        inputs: [
          {
            userId,
            password,
            activePositions: actPositions
              .split(",")
              .map((x) => x.trim())
              .filter((x) => x !== ""),
            runSheets,
          },
        ],
      },
    };

    try {
      await window.electronAPI.saveUserInputs(userInputData);
      alert("Credentials saved successfully!");
      previousRunSheets = runSheets; // update previous selection
      setFieldsEditable(false);
    } catch (error) {
      console.error("Error saving user inputs:", error);
      alert("Failed to save credentials.");
    }
  });
});
