function getAPIKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('apiKey', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.apiKey);
      }
    });
  });
}

function getPrompt() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('prompt', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.prompt);
      }
    });
  });
}

Promise.all([getAPIKey(), getPrompt()]).then(([apiKey, prompt]) => {

  if (apiKey === undefined) {
    console.warn('%cLucid Lens: Please set the Open API key in the options.', 'color: red; font-weight: bold;');
    return;
  }

  if (prompt === undefined) {
    console.warn('%cLucid Lens: Please set the Prompt in the options.', 'color: red; font-weight: bold;');
    return;
  }

  console.log('%cLucid Lens: Successfully loaded options.', 'color: green; font-weight: bold;');

  // Get the hostname of the current site
  let hostname = window.location.hostname;

  // Define different querySelectorAll rules for different websites
  let selector;
  switch (hostname) {
    case 'www.breitbart.com':
      selector = 'article.post a[title], a[itemprop="url"], ul#menu-trending li a, section#DQSW ul li a, ul#BBTrendUL li a';
      break;
    case 'www.reddit.com':
      selector = 'a[data-click-id="body"]';
      break;
    case 'www.cnn.com':
      selector = 'a.zone__title-url, ';
      break;
    // Add more cases as needed...
    default:
      throw new Error(`No selector defined for hostname: ${hostname}`);
  }

  // Now use the selected rule to get the headlines
  let headlines = document.querySelectorAll(selector);

  // Loop through each headline
  headlines.forEach(async (headline) => {

    if (headline.textContent.length < 50) {
      console.log("Too short, excluded: " + headline)
      return;
    }

    // Fetch the linked article content
    let response = await fetch(headline.href);
    let htmlText = await response.text();

    // Parse the HTML text into a document object
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Get the article element
    const article = doc.querySelector('article');

    // Extract the main article text
    const mainText = article.textContent;

    // console.log("For previous headling " + headline + ", using main text: " + mainText)

    // Generate a new headline with OpenAI API
    // TODO Completions is a bit outdated, as is text-davinci-003, but probably replacing this with Web LLM soon anyway?
    const openAIResponse = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt: prompt + `\n\nArticle: "${mainText}"`,
        max_tokens: 200
      })
    });

    const openAIData = await openAIResponse.json();
    const generatedHeadline = openAIData.choices[0].text.trim();

    console.log(generatedHeadline)

    // Replace the old headline with the new one
    headline.textContent = generatedHeadline;

    // Remove all-caps headlines, just easier to read with summaries.
    headline.style.cssText = 'text-transform: none !important;'; // TODO Still doesn't really work.
  });
});