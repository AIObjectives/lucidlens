import Axios from 'axios'; // Using this so we can use axios-cache-interceptor, other caching options were less appealing.
import { setupCache, buildWebStorage } from 'axios-cache-interceptor';
// same object, but with updated typings.
// FYI for when you need it: https://axios-cache-interceptor.js.org/config#debug
const axios = setupCache(Axios, {
  storage: buildWebStorage(localStorage, 'lucidlens-axios-cache:'), // Default is in-memory, which doesn't survive reloads.
  interpretHeader: false, // Have to ignore the return header https://stackoverflow.com/questions/75082152/puzzle-about-using-axios-cache-interceptor
  methods: ['get', 'post'], // We want to add 'post' for the OpenAI API
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

function getArticleExtractionRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('articleExtractionRules', (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.articleExtractionRules);
      }
    });
  });
}

function findClosestParentWithHref(element) {
  let currentElement = element.parentElement;
  while (currentElement) {
    if (currentElement.hasAttribute('href')) {
      return currentElement;
    }
    for (const child of currentElement.children) {
      if (child.hasAttribute('href')) {
        return child;
      }
    }
    currentElement = currentElement.parentElement;
  }

  return null; // If no parent element with href is found
}

Promise.all([
  getAPIKey(),
  getPrompt(),
  getHeadlineRules(),
  getArticleExtractionRules(),
]).then(([apiKey, prompt, headlineRules, articleExtractionRules]) => {
  if (apiKey === undefined) {
    console.warn(
      '%cLucid Lens: Please set the Open API key in the options.',
      'color: red; font-weight: bold;'
    );
    return;
  }

  if (prompt === undefined) {
    console.warn(
      '%cLucid Lens: Please set the Prompt in the options.',
      'color: red; font-weight: bold;'
    );
    return;
  }

  if (headlineRules === undefined) {
    console.warn(
      '%cLucid Lens: Please set the Headline Rules in the options.',
      'color: red; font-weight: bold;'
    );
    return;
  }

  console.log(
    '%cLucid Lens: Successfully loaded options.',
    'color: green; font-weight: bold;'
  );

  // Get the hostname of the current site
  let hostname = window.location.hostname;

  // Get querySelectorAll rules for different websites
  const allSelectors = headlineRules.split(/[\r\n]+/);
  var siteSelectors = [];
  for (let selector of allSelectors) {
    if (selector.startsWith(hostname)) {
      siteSelectors.push(selector.split('##')[1]);
    }
  }
  if (siteSelectors.length != 0) {
    console.log(`Proceeding with selectors: ${siteSelectors}`);
  } else {
    console.log(`No rules found starting with ${hostname}, returning.`);
    return;
  }

  // Now use the selected rule to get the headlines
  var headlines = [];
  for (let selector of siteSelectors) {
    headlines = headlines.concat(
      Array.from(document.querySelectorAll(selector))
    ); // querySelectorAll returns a NodeList, not exactly an array.
  }

  console.log(`Found ${headlines.length} headlines.`);

  // Loop through each headline
  headlines.forEach(async (headline) => {
    const linkElem = findClosestParentWithHref(headline);
    const originalHeadline = headline.textContent;

    if (!linkElem) {
      console.log(
        'Headline has no valid href or parent with valid href, excluded: ' +
          headline.textContent
      );
      return;
    }

    // TODO Need better heuristics for things that are matched by selectors but are not actually headlines. Or need deselectors like adblockers?
    if (linkElem.href.includes('/author/')) {
      console.log(
        'Headline is an author link, excluded: ' + headline.textContent
      );
      return;
    }

    // Fetch the linked article content
    let response = await axios.get(linkElem.href);
    console.log(
      (response.cached ? 'CACHED ARTICLE: ' : 'FETCHED ARTICLE: ') +
        headline.textContent
    );
    let htmlText = response.data;

    // Parse the HTML text into a document object
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Get the article content, using provided rule if available

    let mainText = '';

    const extractionRule = articleExtractionRules
      .split(/[\r\n]+/)
      .find((selector) => selector.startsWith(hostname));

    if (extractionRule) {
      const selector = extractionRule.split('##')[1];
      mainText = [...doc.querySelectorAll(selector)].map(htmlToText).join('\n');
      console.log('EXTRACTED ARTICLE USING RULE', { selector, mainText });
    } else {
      const articleElement = doc.querySelector('article');
      if (articleElement !== undefined) {
        mainText = htmlToText(articleElement.innerHTML);
      } else {
        console.log(
          `No textContent found for headline "${headline.textContent}" at ${linkElem.href}, rewriting without article content.`
        );
        mainText = headline.textContent; // This is a bit of a design choice, but I think it's better than nothing..
      }
    }

    // Trim the article text to a reasonable length
    const contextWindowMax = 3000; // It's 4096 for the current model but let's leave lots of room for the prompt.

    if (mainText.length > contextWindowMax) {
      mainText =
        mainText.substring(0, contextWindowMax / 2) +
        ' ... ' +
        mainText.substring(
          mainText.length - contextWindowMax / 2,
          mainText.length
        );
      console.log(
        `For headline "${headline.textContent}", trimmed article to ${contextWindowMax} characters.`
      );
    }

    // Generate a new headline with OpenAI API
    // TODO Completions is a bit outdated, as is text-davinci-003 (EOL 1/4/2024), but probably replacing this with Web LLM soon anyway?
    var postData = {
      model: 'text-davinci-003',
      prompt: prompt + `\n${mainText}`,
      max_tokens: 200,
    };
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    };
    // We could potentially do this concurrently but I'm mildly worried about rate limiting and don't have explicit backoff/retry logic.
    await axios
      .post('https://api.openai.com/v1/completions', postData, {
        headers: headers,
      })
      .then((response) => {
        const generatedHeadline = response.data.choices[0].text
          .trim()
          .replace(/(\r\n|\n|\r)/gm, ''); // Sometimes you get linebreaks back.
        // console.log(`Post: ${postData.prompt}\nReponse: ${generatedHeadline}`);
        console.log(
          (response.cached ? 'CACHED HEADLINE: ' : 'GENERATED HEADLINE: ') +
            originalHeadline +
            '==>' +
            generatedHeadline
        );

        // Replace the old headline with the new one
        headline.textContent = '✨' + generatedHeadline;
      })
      .catch((error) => {
        console.error(error);
      });
  });
});
