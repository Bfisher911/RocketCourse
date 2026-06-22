import { afterEach, describe, expect, it, vi } from "vitest";
import contact from "../../netlify/functions/contact";

const post = (body: unknown, ip: string): Request =>
  new Request("https://rocketcourse.app/.netlify/functions/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body)
  });

const valid = {
  name: "Dr. Jane Smith",
  email: "jane@university.edu",
  institution: "State University",
  role: "Instructor / Faculty",
  inquiryType: "Pilot or trial",
  message: "We would love to pilot RocketCourse in our department next term.",
  pilot: true,
  website: ""
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("contact function", () => {
  it("rejects non-POST", async () => {
    const res = await contact(new Request("https://x/", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("silently accepts and drops honeypot submissions", async () => {
    const res = await contact(post({ ...valid, website: "http://spam.example" }, "10.0.0.1"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { dropped?: boolean };
    expect(json.dropped).toBe(true);
  });

  it("validates required fields", async () => {
    const res = await contact(post({ name: "A", email: "nope", message: "short" }, "10.0.0.2"));
    expect(res.status).toBe(422);
  });

  it("returns 503 with fallback when no email provider is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await contact(post(valid, "10.0.0.3"));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { fallback?: boolean };
    expect(json.fallback).toBe(true);
  });

  it("sends via Resend with a RocketCourse-prefixed subject when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const res = await contact(post(valid, "10.0.0.4"));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("api.resend.com");
    const sent = JSON.parse(init.body as string) as { to: string[]; subject: string; reply_to: string };
    expect(sent.to).toContain("rocketproofai@gmail.com");
    expect(sent.subject.startsWith("[RocketCourse Inquiry]")).toBe(true);
    expect(sent.reply_to).toBe(valid.email);
  });

  it("rate-limits rapid repeat submissions from the same client", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const first = await contact(post(valid, "10.0.0.5"));
    expect([503, 200]).toContain(first.status);
    const second = await contact(post(valid, "10.0.0.5"));
    expect(second.status).toBe(429);
  });
});
