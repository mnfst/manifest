(function () {
  var supportedLocales = ['en', 'ru'];
  var t = null;
  var storedLocale = null;
  try {
    t = localStorage.getItem('theme');
    storedLocale = localStorage.getItem('manifest.locale');
  } catch (_) {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }

  var locale = supportedLocales.indexOf(storedLocale) !== -1 ? storedLocale : null;
  if (!locale) {
    var languages =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (var i = 0; i < languages.length; i += 1) {
      var language = String(languages[i] || '')
        .toLowerCase()
        .split(/[-_]/, 1)[0];
      if (supportedLocales.indexOf(language) !== -1) {
        locale = language;
        break;
      }
    }
  }
  document.documentElement.lang = locale || 'en';
})();
