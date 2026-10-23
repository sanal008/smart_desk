import { describe, expect, it } from "vitest";

import { cn } from "@/lib/cn";
import { isOverdue, minutesUntil, pct, timeAgo } from "@/lib/format";

describe("cn", () => {
  it("merges tailwind classes and drops conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "font-bold")).toBe("text-sm font-bold");
    const hidden = false;
    expect(cn(hidden && "hidden", "block")).toBe("block");
  });
});

describe("format helpers", () => {
  it("timeAgo handles missing values", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
  });

  it("isOverdue detects past dates", () => {
    expect(isOverdue(new Date(Date.now() - 60_000).toISOString())).toBe(true);
    expect(isOverdue(new Date(Date.now() + 60_000).toISOString())).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });

  it("minutesUntil returns signed minutes", () => {
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const value = minutesUntil(inTwoHours);
    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThan(110);
    expect(value!).toBeLessThan(130);
  });

  it("pct formats ratios", () => {
    expect(pct(0.873)).toBe("87%");
    expect(pct(null)).toBe("—");
  });
});
