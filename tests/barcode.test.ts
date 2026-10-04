import { describe, expect, it } from "vitest";

import { normalizeBarcode } from "@/lib/barcode";

describe("normalizeBarcode", () => {
  it("accepts standard retail code lengths", () => {
    expect(normalizeBarcode("8901234567890")).toBe("8901234567890"); // EAN-13
    expect(normalizeBarcode("012345678905")).toBe("012345678905"); // UPC-A
    expect(normalizeBarcode("96385074")).toBe("96385074"); // EAN-8
    expect(normalizeBarcode("123456")).toBe("123456"); // min length
    expect(normalizeBarcode("12345678901234")).toBe("12345678901234"); // max length (GTIN-14)
  });

  it("tolerates spaces and hyphens", () => {
    expect(normalizeBarcode(" 890-1234567890 ")).toBe("8901234567890");
    expect(normalizeBarcode("890 1234 567890")).toBe("8901234567890");
  });

  it("rejects too-short and too-long codes", () => {
    expect(normalizeBarcode("12345")).toBeNull();
    expect(normalizeBarcode("123456789012345")).toBeNull();
  });

  it("rejects non-numeric payloads (e.g. Code-128 shipping labels)", () => {
    expect(normalizeBarcode("ABC123456")).toBeNull();
    expect(normalizeBarcode("12a34b56")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
  });
});
