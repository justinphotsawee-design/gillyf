export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true;
  // iPadOS 13+ requests the desktop site by default, so an iPad's UA
  // string has no "iPad" token at all — it claims to be a Mac. The one
  // signal a real Mac never has is touch points, so that's the fallback
  // (matches Apple's own documented technique for telling the two apart).
  return (
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1 &&
    /Macintosh/i.test(navigator.userAgent)
  );
}

// LINE, Facebook/Instagram, Messenger, X, TikTok, WeChat, WhatsApp,
// Snapchat, Pinterest, and Naver's in-app browser all open links in
// their own embedded webview instead of the system browser.
// window.open() there spawns a *separate* webview instance rather than a
// real browser tab, and that instance can't resolve a blob: URL created
// in the page that opened it (blob URLs only live in the browsing
// context that created them) — the popup just renders blank.
const IN_APP_BROWSER_PATTERN =
  /Line\/|FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK|TikTok|musical_ly|Twitter|\/IAB|WhatsApp|Snapchat|Pinterest\/|NAVER\(inapp/i;

// Catch-all for any *other* Android app's in-app browser, even ones with
// no distinctive name in their UA (Discord, Telegram, random shopping
// apps, …): Chromium tags every Android WebView — regardless of which
// app embeds it — with a "; wv)" token, unlike the system Chrome/Firefox/
// Samsung Internet browsers. See https://developer.chrome.com/docs/androidwebview/user-agent.
const ANDROID_WEBVIEW_PATTERN = /; ?wv\)/i;

export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    IN_APP_BROWSER_PATTERN.test(navigator.userAgent) ||
    ANDROID_WEBVIEW_PATTERN.test(navigator.userAgent)
  );
}
