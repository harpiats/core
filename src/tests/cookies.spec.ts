import { beforeEach, describe, expect, it } from "bun:test";
import { Cookies } from "../cookies";

describe("Cookies", () => {
  let cookies: Cookies;

  beforeEach(() => {
    cookies = new Cookies();
  });

  it("should parse cookies from a header string", () => {
    const cookieHeader = "key1=value1; key2=value2; key3=value%203";
    cookies = new Cookies(cookieHeader);

    expect(cookies.get("key1")).toBe("value1");
    expect(cookies.get("key2")).toBe("value2");
    expect(cookies.get("key3")).toBe("value 3");
  });

  it("should handle empty cookie header string", () => {
    const cookieHeader = "";
    cookies = new Cookies(cookieHeader);

    expect(cookies.get("anyKey")).toBeUndefined();
    expect(cookies.getAll()).toEqual({});
  });

  it("should get a cookie by name", () => {
    cookies = new Cookies("key1=value1; key2=value2");
    expect(cookies.get("key1")).toBe("value1");
  });

  it("should return undefined for a non-existent cookie", () => {
    expect(cookies.get("nonExistent")).toBeUndefined();
  });

  it("should set a cookie with default options", () => {
    const result = cookies.set("newKey", "newValue");
    expect(result).toBe("newKey=newValue");
  });

  it("should set a cookie with path", () => {
    const result = cookies.set("pathKey", "pathValue", { path: "/myPath" });
    expect(result).toBe("pathKey=pathValue; Path=/myPath");
  });

  it("should set a cookie with domain", () => {
    const result = cookies.set("domainKey", "domainValue", { domain: "example.com" });
    expect(result).toBe("domainKey=domainValue; Domain=example.com");
  });

  it("should set a cookie with maxAge", () => {
    const result = cookies.set("maxAgeKey", "maxAgeValue", { maxAge: 3600 });
    expect(result).toBe("maxAgeKey=maxAgeValue; Max-Age=3600");
  });

  it("should set a cookie with expires", () => {
    const expires = new Date("2024-12-31T23:59:59Z");
    const result = cookies.set("expiresKey", "expiresValue", { expires });
    expect(result).toBe(`expiresKey=expiresValue; Expires=${expires.toUTCString()}`);
  });

  it("should set a cookie with httpOnly", () => {
    const result = cookies.set("httpOnlyKey", "httpOnlyValue", { httpOnly: true });
    expect(result).toBe("httpOnlyKey=httpOnlyValue; HTTPOnly");
  });

  it("should set a cookie with secure", () => {
    const result = cookies.set("secureKey", "secureValue", { secure: true });
    expect(result).toBe("secureKey=secureValue; Secure");
  });

  it("should set a cookie with sameSite", () => {
    const result = cookies.set("sameSiteKey", "sameSiteValue", { sameSite: "Strict" });
    expect(result).toBe("sameSiteKey=sameSiteValue; SameSite=Strict");
  });

  it("should set multiple cookie options", () => {
    const expires = new Date("2024-12-31T23:59:59Z");
    const result = cookies.set("multipleOptionsKey", "multipleOptionsValue", {
      path: "/test",
      domain: "test.com",
      maxAge: 1800,
      expires,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
    expect(result).toBe(
      `multipleOptionsKey=multipleOptionsValue; Path=/test; Domain=test.com; Max-Age=1800; Expires=${expires.toUTCString()}; HTTPOnly; Secure; SameSite=Lax`,
    );
  });

  it("should delete a cookie", () => {
    cookies.set("keyToDelete", "value");
    const result = cookies.delete("keyToDelete");

    expect(result).toContain("keyToDelete=");
    expect(result).toContain("Max-Age=0");
    expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(cookies.get("keyToDelete")).toBeUndefined();
  });

  it("should delete a cookie with path", () => {
    cookies.set("keyToDelete", "value", { path: "/myPath" });
    const result = cookies.delete("keyToDelete", { path: "/myPath" });

    expect(result).toContain("keyToDelete=");
    expect(result).toContain("Max-Age=0");
    expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(result).toContain("Path=/myPath");
    expect(cookies.get("keyToDelete")).toBeUndefined();
  });

  it("should delete a cookie with domain", () => {
    cookies.set("keyToDelete", "value", { domain: "example.com" });
    const result = cookies.delete("keyToDelete", { domain: "example.com" });

    expect(result).toContain("keyToDelete=");
    expect(result).toContain("Max-Age=0");
    expect(result).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(result).toContain("Domain=example.com");
    expect(cookies.get("keyToDelete")).toBeUndefined();
  });

  it("should get all cookies", () => {
    cookies = new Cookies("key1=value1; key2=value2");
    expect(cookies.getAll()).toEqual({ key1: "value1", key2: "value2" });
  });

  it("should get all cookies when no cookies are set", () => {
    expect(cookies.getAll()).toEqual({});
  });

  it("should handle special characters in cookie values", () => {
    const specialValue = "value with spaces and = ; characters";
    cookies.set("specialKey", "value with spaces and = ; characters");
    const allCookies = cookies.getAll();

    expect(allCookies.specialKey).toEqual(specialValue);
  });

  it("should handle url encoded characters in cookie header", () => {
    const encodedHeader = "key%20one=value%20one";
    cookies = new Cookies(encodedHeader);
    const allCookies = cookies.getAll();

    expect(allCookies).toEqual({ "key one": "value one" });
  });
});
