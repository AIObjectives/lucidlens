# <img src="public/icons/icon_48.png" width="45" align="left"> Lucidlens

Prototype for AOI Lucid Lens project, primarily augmented browsing.

## Install

1. `cd lucidlens`
2. Run `npm run watch`
3. Open chrome://extensions
4. Check the `Developer mode` checkbox
5. Click on the `Load unpacked extension` button
6. Select the folder `lucidlens/build`

## How to beta-test

Open the Options page of the extension and enter some OpenAI API key.
Try opening some of the following websites and see the magic happen:

- [https://www.foxnews.com/](foxnews.com)
- [https://www.cnn.com/](cnn.com)
- [https://www.breitbart.com/](breitbart.com)
- [https://www.theguardian.com/international](guardian.com)
- [https://www.bbc.com/news](bbc.com)
- [https://www.aljazeera.com/](aljazeera.com)

You'll know that a headline has been replaced by a generated ones when it starts with '✨'.

## Contribution

Suggestions and pull requests are welcomed!
After changing the code, visit chrome://extensions and click on the reload button to reload the extension.

---

This project was bootstrapped with [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)
