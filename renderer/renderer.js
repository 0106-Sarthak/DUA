document.addEventListener('DOMContentLoaded', async () => {
  // Load saved config
  const config = await window.electronAPI.getConfig();
  if (config) {
    document.getElementById('user_id').value = config.user_id || '';
    document.getElementById('host').value = config.host || '';
  }

  // Load user inputs
  const userInputs = await window.electronAPI.getUserInputs();
  if (userInputs) {
    // Assuming 'default' actionSheetId for development
    const inputs = userInputs['default']?.inputs || {};
    document.getElementById('input_token_1').value = inputs['token_1'] || '';
    document.getElementById('input_token_2').value = inputs['token_2'] || '';
  }
  console.log('User Inputs Loaded:', userInputs);

  // Handle config & input form submission
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Save config
    const user_id = document.getElementById('user_id').value;
    const host = document.getElementById('host').value;

    await window.electronAPI.saveConfig({ 
      user_id, 
      host,
      endpoints: {
        config: "/config/{{userId}}",
        report_upload: "/report/upload/{{userId}}"
      },
      action_sheets: []
    });

    // Save user inputs
    const userInputData = {
      'default': { // temporary for development
        id: 'default',
        name: 'default',
        inputs: {
          token_1: document.getElementById('input_token_1').value,
          token_2: document.getElementById('input_token_2').value
        }
      }
    };

    await window.electronAPI.saveUserInputs(userInputData);

    alert('Configuration and User Inputs saved!');
  });
});
