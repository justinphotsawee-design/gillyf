import { describe, it, expect, afterEach } from "vitest";
import { isInAppBrowser, isMobileBrowser } from "./browser";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function setMaxTouchPoints(points: number) {
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    value: points,
    configurable: true,
  });
}

const REAL_UA = window.navigator.userAgent;
const REAL_MAX_TOUCH_POINTS = window.navigator.maxTouchPoints;

describe("isMobileBrowser", () => {
  afterEach(() => {
    setUserAgent(REAL_UA);
    setMaxTouchPoints(REAL_MAX_TOUCH_POINTS);
  });

  it("detects iPhone", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    );
    expect(isMobileBrowser()).toBe(true);
  });

  it("detects Android", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    );
    expect(isMobileBrowser()).toBe(true);
  });

  it("detects iPad running the default desktop-site UA (no 'iPad' token, touch-capable)", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
    );
    setMaxTouchPoints(5);
    expect(isMobileBrowser()).toBe(true);
  });

  it("does not flag desktop Chrome as mobile", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    );
    setMaxTouchPoints(0);
    expect(isMobileBrowser()).toBe(false);
  });
});

describe("isInAppBrowser", () => {
  afterEach(() => setUserAgent(REAL_UA));

  const inAppUAs: Record<string, string> = {
    LINE: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ... Line/14.5.0",
    "Facebook (FBAN)": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ... [FBAN/FBIOS;FBAV/470.0]",
    Instagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Instagram 300.0.0",
    Messenger: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) [FBAN/MessengerForiOS]",
    WeChat: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) MicroMessenger/8.0.0",
    KakaoTalk: "Mozilla/5.0 (Linux; Android 14) KAKAOTALK 10.0.0",
    TikTok: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) musical_ly_2024",
    WhatsApp: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) WhatsApp/24.5.81",
    Snapchat: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Snapchat/12.70.0",
    Pinterest: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Pinterest/11.31",
    "Naver in-app": "Mozilla/5.0 (Linux; Android 14) NAVER(inapp; search; 1200; 12.5.1)",
    // Any Android app's embedded WebView — Discord, Telegram, random
    // shopping apps, etc. — even with no app-specific token, Chromium
    // still tags the UA with "; wv)" for a WebView vs. system Chrome.
    "generic Android WebView (Discord, Telegram, ...)":
      "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36",
  };

  for (const [name, ua] of Object.entries(inAppUAs)) {
    it(`flags ${name} as an in-app browser`, () => {
      setUserAgent(ua);
      expect(isInAppBrowser()).toBe(true);
    });
  }

  it("does not flag regular mobile Safari as in-app", () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    );
    expect(isInAppBrowser()).toBe(false);
  });

  it("does not flag regular Android Chrome as in-app", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
    );
    expect(isInAppBrowser()).toBe(false);
  });

  it("does not flag regular Android Firefox as in-app", () => {
    setUserAgent(
      "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0"
    );
    expect(isInAppBrowser()).toBe(false);
  });
});
