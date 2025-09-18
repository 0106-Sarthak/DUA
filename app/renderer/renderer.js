document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('setup-form');
  const editButton = document.getElementById('edit-button');
  const saveButton = document.getElementById('save-button');

  const fields = ['userId', 'password', 'insightId', 'insightPassword', 'qtyCondition'].map(id => document.getElementById(id));

  function setFieldsEditable(editable) {
    fields.forEach(field => field.disabled = !editable);
    saveButton.style.display = editable ? 'inline-block' : 'none';
    editButton.style.display = editable ? 'none' : 'inline-block';
  }

  try {
    const userInputs = await window.electronAPI.getUserInputs();
    const existing = userInputs['test-sheet']?.inputs || {};
    const isEdit = Object.keys(existing).length > 0;

    if (isEdit) {
      // Pre-fill and disable form
      document.getElementById('userId').value = existing.userId || '';
      document.getElementById('password').value = existing.password || '';
      document.getElementById('insightId').value = existing.insightId || '';
      document.getElementById('insightPassword').value = existing.insightPassword || '';
      document.getElementById('qtyCondition').value = existing.qtyCondition || '';

      setFieldsEditable(false);
    } else {
      setFieldsEditable(true);
    }
  } catch (error) {
    console.error('Error loading user inputs:', error);
    setFieldsEditable(true);
  }

  editButton.addEventListener('click', () => {
    setFieldsEditable(true);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value.trim();
    const password = document.getElementById('password').value.trim();
    const insightId = document.getElementById('insightId').value.trim();
    const insightPassword = document.getElementById('insightPassword').value.trim();
    const qtyCondition = document.getElementById('qtyCondition').value.trim();

    if (!userId || !password || !insightId || !insightPassword) {
      alert('Please fill all required fields.');
      return;
    }

    const userInputData = {
      "test-sheet": {
        "inputs": {
          userId,
          password,
          insightId,
          insightPassword,
          qtyCondition
        }
      }
    };

    try {
      await window.electronAPI.saveUserInputs(userInputData);
      alert('Credentials saved successfully!');
      setFieldsEditable(false);
    } catch (error) {
      console.error('Error saving user inputs:', error);
      alert('Failed to save credentials.');
    }
  });
});
