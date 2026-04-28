// Only unambiguous browse-intent phrases. Generic web-dev vocabulary
// (html, dom, url, http, link, page, site, domain, tab, fetch, google,
// download, rss, sitemap, whois, scroll, screenshot) was removed because
// it misroutes coding sessions — see discussion #1613. Phrases that still
// read as browse intent are kept (`this page`, `on this site`) because they
// don't appear in realistic coding requests, which say "the page" / "the
// site" instead.
export const WEB_BROWSING_KEYWORDS = [
  'browse',
  'browse to',
  'navigate',
  'navigate to',
  'visit',
  'open url',
  'open the url',
  // `open this` subsumes "open this url/link/page/webpage" — do not list
  // the longer forms alongside, they produce stacked matches on a single
  // phrase (noted by Cubic review on #1639).
  'open this',
  // `click on the` is kept alongside `click on` on purpose: both at
  // weight 2, they stack to 4 on "click on the button" and clear the
  // web_browsing threshold of 3. `click on` alone (weight 2) would miss it.
  'click the',
  'click on',
  'click on the',
  'scroll to',
  'scroll down',
  'scroll up',
  'take a screenshot',
  'screenshot of',
  'scrape',
  'web search',
  'search for',
  'search on',
  'fetch url',
  'fetch the url',
  'crawl',
  'bookmark this',
  'go to',
  'fill out',
  'fill out the form',
  'look up',
  'website',
  'webpage',
  'web page',
  'this website',
  'this webpage',
  'this site',
  'this page',
  'this url',
  'this domain',
  'on this page',
  'on this site',
  'on this website',
  'from this page',
];
