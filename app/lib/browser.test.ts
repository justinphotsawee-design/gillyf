import { describe, it, expect, afterEach } from "vitest";
import { isInAppBrowser, isMobileBrowser } from "./browser";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const REAL_UA = window.navigator.userAgent;

describe("isMobileBrowser", () => {
  afterEach(() => setUserAgent(REAL_UA));

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

  it("does not flag desktop Chrome as mobile", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    );
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
});
