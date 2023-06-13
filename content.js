// content.js

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

  console.log("For previous headling " + headline + ", using main text: " + mainText)
  
  // Generate a new headline with OpenAI API
  const openAIResponse = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer REDACTED'
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt: `Give me an objective, neutral, factual three sentence summary for the article content below.\n\nArticle: "${mainText}"`,
      max_tokens: 30
    })
  });

  const openAIData = await openAIResponse.json();
  const generatedHeadline = openAIData.choices[0].text.trim();

  console.log(generatedHeadline)

  // Replace the old headline with the new one
  headline.textContent = generatedHeadline;
});