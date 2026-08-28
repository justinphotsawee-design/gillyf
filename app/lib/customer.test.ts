import { describe, it, expect, beforeEach } from "vitest";
import { loadCustomerInfo, saveCustomerInfo } from "./customer";

describe("customer info (sessionStorage gate)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("returns null when nothing has been saved", () => {
    expect(loadCustomerInfo()).toBeNull();
  });

  it("round-trips a saved name", () => {
    saveCustomerInfo({ name: "ต้นข้าว" });
    expect(loadCustomerInfo()).toEqual({ name: "ต้นข้าว" });
  });

  it("uses sessionStorage, not localStorage — a per-visit gate, not a login", () => {
    saveCustomerInfo({ name: "Alex" });
    expect(window.localStorage.getItem("gilly:customer")).toBeNull();
    expect(window.sessionStorage.getItem("gilly:customer")).not.toBeNull();
  });

  it("returns null for corrupted JSON instead of throwing", () => {
    window.sessionStorage.setItem("gilly:customer", "{not json");
    expect(loadCustomerInfo()).toBeNull();
  });

  it("returns null when the stored object has no name field", () => {
    window.sessionStorage.setItem("gilly:customer", JSON.stringify({ foo: "bar" }));
    expect(loadCustomerInfo()).toBeNull();
  });

  it("returns null when name is an empty string", () => {
    window.sessionStorage.setItem("gilly:customer", JSON.stringify({ name: "" }));
    expect(loadCustomerInfo()).toBeNull();
  });
});
