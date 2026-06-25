import { describe, expect, it } from "vitest";
import { buildWaitlistWelcomeEmail } from "./campaignEmail";

describe("buildWaitlistWelcomeEmail", () => {
  const base = {
    firstName: "Pat",
    campaignName: "RocketCourse Founding Cohort",
    outcome: "open" as const,
    discountCode: "FOUNDING40",
    discountPercent: 40,
    discountMonths: 3,
    referralUrl: "https://site.com/founding-cohort?ref=RC-7K2QF9",
    referralRewardSummary: "Invite 3 colleagues, unlock one free month.",
    wantsWebinar: true,
    webinarTitle: "AI Course Building Workshop",
    webinarUrl: "https://zoom.example/abc",
    webinarWhen: "Friday, July 10, 2026 at 1:00 PM"
  };

  it("greets by name and includes discount, webinar, and referral details", () => {
    const { subject, html, text } = buildWaitlistWelcomeEmail(base);
    expect(subject).toContain("Welcome");
    expect(text).toContain("Hi Pat,");
    expect(text).toContain("FOUNDING40");
    expect(text).toContain("40% off your first 3 months");
    expect(text).toContain("https://zoom.example/abc");
    expect(text).toContain("https://site.com/founding-cohort?ref=RC-7K2QF9");
    expect(html).toContain("FOUNDING40");
    expect(html).toContain("RC-7K2QF9");
  });

  it("uses a waitlist subject + copy and omits the discount when waitlisted", () => {
    const { subject, text } = buildWaitlistWelcomeEmail({ ...base, outcome: "waitlist" });
    expect(subject).toContain("waitlist");
    expect(text).toContain("on the waitlist");
    expect(text).not.toContain("FOUNDING40"); // no code while waitlisted
  });

  it("falls back to a generic greeting and skips the webinar when not requested", () => {
    const { text } = buildWaitlistWelcomeEmail({ ...base, firstName: "", wantsWebinar: false });
    expect(text).toContain("Hi there,");
    expect(text).not.toContain("zoom.example");
  });

  it("escapes HTML-hostile characters in dynamic values", () => {
    const { html } = buildWaitlistWelcomeEmail({ ...base, firstName: "<script>", referralRewardSummary: "A & B" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<script>");
  });

  it("omits sections cleanly when their data is absent", () => {
    const { text } = buildWaitlistWelcomeEmail({
      firstName: null,
      campaignName: "Founding Cohort",
      outcome: "open",
      discountCode: null,
      referralUrl: null
    });
    expect(text).toContain("You're in!");
    expect(text).not.toContain("discount code");
  });
});
