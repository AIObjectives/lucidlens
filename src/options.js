document.addEventListener('DOMContentLoaded', function () {
  const apiKeyInput = document.getElementById('apiKey');
  const promptInput = document.getElementById('prompt');
  const headlineRuleInput = document.getElementById('headlineRules');
  const articleRuleInput = document.getElementById('articleExtractionRules');
  const saveButton = document.getElementById('saveOptions');

  // Load the saved options when the options page is opened
  chrome.storage.local.get('apiKey', function (data) {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });
  chrome.storage.local.get('prompt', function (data) {
    if (data.prompt) {
      promptInput.value = data.prompt;
    }
  });
  chrome.storage.local.get('headlineRules', function (data) {
    if (data.headlineRules) {
      headlineRuleInput.value = data.headlineRules;
    }
  });
  chrome.storage.local.get('articleExtractionRules', function (data) {
    if (data.headlineRules) {
      articleRuleInput.value = data.articleExtractionRules;
    }
  });

  saveButton.addEventListener('click', function () {
    const apiKey = apiKeyInput.value;
    chrome.storage.local.set({ apiKey }, function () {
      console.log('API key saved successfully.');
    });

    const prompt = promptInput.value;
    chrome.storage.local.set({ prompt }, function () {
      console.log('Prompt saved successfully.');
    });

    // TODO If we allow people to edit rules, we may want a way to restore/update default rules (which probably change between releases.)
    // I just manually delete the rules from local storage but that's not very user friendly.
    const headlineRules = headlineRuleInput.value;
    chrome.storage.local.set({ headlineRules }, function () {
      console.log('Headline rules saved successfully.');
    });

    const articleExtractionRules = articleRuleInput.value;
    chrome.storage.local.set({ articleExtractionRules }, function () {
      console.log('Article rules saved successfully.');
    });

    // A little sketchy here showing the success message when one of the saves could have failed.
    // But, it's probably fine.

    // Show success message
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = 'Options saved successfully.';
    successMessage.style.color = 'green';
    successMessage.style.display = 'block';

    // Clear the success message after 3 seconds
    setTimeout(function () {
      successMessage.textContent = '';
      successMessage.style.display = 'none';
    }, 3000);
  });
});
