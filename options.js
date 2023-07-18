document.addEventListener('DOMContentLoaded', function () {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveKey');

    // Load the saved API key when the options page is opened
    chrome.storage.local.get('apiKey', function (data) {
        if (data.apiKey) {
            apiKeyInput.value = data.apiKey;
        }
    });

    saveButton.addEventListener('click', function () {
        const apiKey = apiKeyInput.value;

        chrome.storage.local.set({ apiKey }, function () {
            console.log('API key saved successfully.');

            // Show success message
            const successMessage = document.getElementById('successMessage');
            successMessage.textContent = 'API key saved successfully.';
            successMessage.style.color = 'green';
            successMessage.style.display = 'block';

            // Clear the success message after 3 seconds
            setTimeout(function () {
                successMessage.textContent = '';
                successMessage.style.display = 'none';
            }, 3000);
        });
    });
});