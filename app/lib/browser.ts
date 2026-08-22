export function isMobileBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
}

// LINE, Facebook/Instagram, Messenger, X, TikTok, and WeChat all open
// links in their own embedded webview instead of the system browser.
// window.open() there spawns a *separate* webview instance rather than a
// real browser tab, and that instance can't resolve a blob: URL created
// in the page that opened it (blob URLs only live in the browsing
// context that created them) — the popup just renders blank.
const IN_APP_BROWSER_PATTERN =
  /Line\/|FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK|TikTok|musical_ly|Twitter|\/IAB/i;

export function isInAppBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    IN_APP_BROWSER_PATTERN.test(navigator.userAgent)
  );
}
