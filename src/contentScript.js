import Axios from 'axios'; // Using this so we can use axios-cache-interceptor, other caching options were less appealing.
import { setupCache, buildWebStorage } from 'axios-cache-interceptor';
// same object, but with updated typings.
// FYI for when you need it: https://axios-cache-interceptor.js.org/config#debug
const axios = setupCache(Axios, {
  storage: buildWebStorage(localStorage, 'lucidlens-axios-cache:'), // Default is in-memory, which doesn't survive reloads.
  interpretHeader: false, // Have to ignore the return header https://stackoverflow.com/questions/75082152/puzzle-about-using-axios-cache-interceptor
  methods: ['get', 'post'] // We want to add 'post' for the OpenAI API
});

import { htmlToText } from 'html-to-text';

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

function getHeadlineRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('headlineRules', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.headlineRules);
      }
    });
  });
}

Promise.all([getAPIKey(), getPrompt(), getHeadlineRules()]).then(([apiKey, prompt, headlineRules]) => {

  if (apiKey === undefined) {
    console.warn('%cLucid Lens: Please set the Open API key in the options.', 'color: red; font-weight: bold;');
    return;
  }

  if (prompt === undefined) {
    console.warn('%cLucid Lens: Please set the Prompt in the options.', 'color: red; font-weight: bold;');
    return;
  }

  if (headlineRules === undefined) {
    console.warn('%cLucid Lens: Please set the Headline Rules in the options.', 'color: red; font-weight: bold;');
    return;
  }

  console.log('%cLucid Lens: Successfully loaded options.', 'color: green; font-weight: bold;');

  // Get the hostname of the current site
  let hostname = window.location.hostname;

  // Get querySelectorAll rules for different websites
  const allSelectors = headlineRules.split(/[\r\n]+/);
  var siteSelectors = [];
  for (let selector of allSelectors) {
    if (selector.startsWith(hostname)) {
      siteSelectors.push(selector.split("##")[1]);
    }
  }
  if (siteSelectors.length != 0) {
    console.log(`Proceeding with selectors: ${siteSelectors}`);
  } else {
    console.log(`No rules found, returning.`);
    return;
  }

  // Now use the selected rule to get the headlines
  var headlines = [];
  for (let selector of siteSelectors) {
    headlines = headlines.concat(Array.from(document.querySelectorAll(selector))); // querySelectorAll returns a NodeList, not exactly an array.
  }

  // Loop through each headline
  headlines.forEach(async (headline) => {

    // TODO Need better heuristics for things that are matched by selectors but are not actually headlines. Or need deselectors like adblockers?

    if (headline.href === undefined) {
      console.log("Headline has no valid href, excluded: " + headline.textContent)
      return;
    }

    // Fetch the linked article content
    let response = await fetch(headline.href); // TODO We should probably cache these too but they're cheaper.
    let htmlText = await response.text();

    // Parse the HTML text into a document object
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Get the article element
    // TODO This isn't always present, probably need a set of heuristics to find the main content.
    const articleElement = doc.querySelector('article');

    var mainText = "";
    if (articleElement !== undefined) {
      // Extract the main article text
      const articleText = htmlToText(articleElement.innerHTML)
      // TODO Choosing the beginning and end of the article if it's too long is a decision choice, but probably still enough context?
      const contextWindowMax = 3000; // It's 4096 for the current model but let's leave lots of room for the prompt.
      mainText = articleText;
      if (articleText.length > contextWindowMax) {
        mainText = articleText.substring(0, contextWindowMax / 2) + " ... " + articleText.substring(articleText.length - contextWindowMax / 2, articleText.length);
        console.log(`For headline "${headline.textContent}", trimmed article to ${contextWindowMax} characters.`);
      }
      // console.log(article);
    } else {
      console.log(`No textContent found for headline "${headline.textContent}" at ${headline.href}, rewriting without article content.`);
      mainText = headline.textContent; // This is a bit of a design choice, but I think it's better than nothing..
    }

    // Generate a new headline with OpenAI API
    // TODO Completions is a bit outdated, as is text-davinci-003 (EOL 1/4/2024), but probably replacing this with Web LLM soon anyway?
    var postData = {
      model: "text-davinci-003",
      prompt: prompt + `\n${mainText}`,
      max_tokens: 200
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    // We could potentially do this concurrently but I'm mildly worried about rate limiting and don't have explicit backoff/retry logic.
    await axios.post('https://api.openai.com/v1/completions', postData, { headers: headers })
      .then((response) => {
        const generatedHeadline = response.data.choices[0].text.trim().replace(/(\r\n|\n|\r)/gm, ""); // Sometimes you get linebreaks back.
        // console.log(`Post: ${postData.prompt}\nReponse: ${generatedHeadline}`);
        console.log((response.cached ? "CACHED: " : "GENERATED: ") + generatedHeadline);

        // Replace the old headline with the new one
        headline.textContent = "!!!" + generatedHeadline;
      })
      .catch((error) => {
        console.error(error);
      });
  });
});