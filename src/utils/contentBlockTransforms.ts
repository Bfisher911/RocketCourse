import { ROCK_QUICK_ACTIONS, type RockQuickActionId } from "../data/contentBlockToolkit";
import type { ContentBlockId, ContentBlockContext } from "./contentBlocks";
import { buildContentBlockHtml } from "./contentBlocks";
import { stripHtml } from "./text";

export type RockTransformMode = "insert" | "replace";

export interface RockTransformResult {
  label: string;
  mode: RockTransformMode;
  html: string;
}

const escapeHtml = (value: string | number | undefined | null): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraph = (text: string): string => `<p style="margin: 0 0 12px; color: #374151;">${escapeHtml(text)}</p>`;

const plainText = (html: string): string => stripHtml(html).replace(/\s+/g, " ").trim();

const firstSentences = (html: string, limit = 4): string[] => {
  const text = plainText(html);
  if (!text) return [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean).slice(0, limit);
};

const listItemsFrom = (html: string): string[] => {
  const matches = Array.from(html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).map((match) => plainText(match[1]));
  if (matches.length) return matches.filter(Boolean).slice(0, 8);
  return firstSentences(html, 5);
};

const blockSet = (ids: ContentBlockId[], context: ContentBlockContext): string =>
  ids.map((id) => buildContentBlockHtml(id, context)).join("\n");

const cardTransform = (context: ContentBlockContext, sourceHtml: string): string => {
  const cards = firstSentences(sourceHtml, 4);
  const fallback = ["Main idea", "Example", "Student task"];
  const items = (cards.length ? cards : fallback).map((text, index) => ({
    title: index === 0 ? "Main Idea" : index === 1 ? "Example" : index === 2 ? "Try It" : `Card ${index + 1}`,
    body: text
  }));
  const theme = context.course.theme;
  return `<section style="margin: 22px 0; padding: 22px 24px; background: #ffffff; border: 1px solid ${theme.accent}; border-top: 6px solid ${theme.accent}; border-radius: 14px; font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.58;">
  <h2 style="margin: 0 0 12px; color: ${theme.accentDark}; font-size: 24px; line-height: 1.2;">Paragraph as Cards</h2>
  <div style="font-size: 0;">
    ${items
      .map(
        (item) =>
          `<div style="display: inline-block; width: 100%; max-width: 260px; min-width: 205px; box-sizing: border-box; vertical-align: top; margin: 0 12px 12px 0; padding: 15px 16px; border: 1px solid #dbe4f0; border-left: 5px solid ${theme.accent}; border-radius: 11px; font-size: 14px;">
      <h3 style="margin: 0 0 7px; color: #111827; font-size: 17px;">${escapeHtml(item.title)}</h3>
      <p style="margin: 0; color: #374151;">${escapeHtml(item.body)}</p>
    </div>`
      )
      .join("")}
  </div>
</section>`;
};

const timelineTransform = (context: ContentBlockContext, sourceHtml: string): string => {
  const items = listItemsFrom(sourceHtml);
  const theme = context.course.theme;
  const timelineItems = (items.length ? items : ["Start with the overview.", "Practice with an example.", "Submit or reflect.", "Use feedback for the next step."]).slice(0, 6);
  return `<section style="margin: 22px 0; padding: 22px 24px; background: ${theme.soft}; border: 1px solid ${theme.accent}; border-top: 6px solid ${theme.accent}; border-radius: 14px; font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.58;">
  <h2 style="margin: 0 0 12px; color: ${theme.accentDark}; font-size: 24px; line-height: 1.2;">Timeline</h2>
  <ol style="list-style: none; margin: 12px 0 0; padding: 0;">
    ${timelineItems
      .map(
        (item, index) =>
          `<li style="position: relative; margin: 0 0 12px; padding: 12px 14px 12px 54px; background: #ffffff; border: 1px solid #dbe4f0; border-radius: 11px;">
      <span aria-hidden="true" style="position: absolute; left: 14px; top: 12px; width: 26px; height: 26px; border-radius: 50%; background: ${theme.accent}; color: #ffffff; text-align: center; line-height: 26px; font-weight: 900;">${index + 1}</span>
      <h3 style="margin: 0 0 5px; color: #111827; font-size: 16px;">Step ${index + 1}</h3>
      <p style="margin: 0; color: #374151;">${escapeHtml(item)}</p>
    </li>`
      )
      .join("")}
  </ol>
</section>`;
};

const simplifiedLayout = (context: ContentBlockContext, sourceHtml: string): string => {
  const theme = context.course.theme;
  const text = plainText(sourceHtml);
  const overview = firstSentences(sourceHtml, 2).join(" ") || "Use this page to understand what matters, what to do next, and where to get help.";
  const headings = Array.from(sourceHtml.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi))
    .map((match) => plainText(match[1]))
    .filter(Boolean)
    .slice(0, 5);
  const actions = headings.length ? headings : listItemsFrom(sourceHtml).slice(0, 5);
  return `<h1 style="margin: 0 0 12px; color: #111827;">Simplified Page</h1>
<section style="margin: 18px 0; padding: 20px; background: ${theme.soft}; border: 1px solid ${theme.accent}; border-left: 6px solid ${theme.accent}; border-radius: 12px;">
  <h2 style="margin: 0 0 10px; color: ${theme.accentDark};">What this page is for</h2>
  ${paragraph(overview)}
</section>
<section style="margin: 18px 0; padding: 20px; background: #ffffff; border: 1px solid #dbe4f0; border-radius: 12px;">
  <h2 style="margin: 0 0 10px; color: ${theme.accentDark};">What to do next</h2>
  <ul style="margin: 10px 0 0; padding-left: 22px;">${(actions.length ? actions : ["Read the overview.", "Complete the next activity.", "Check the rubric or success criteria.", "Ask a specific question if stuck."])
    .map((item) => `<li style="margin: 7px 0; color: #374151;">${escapeHtml(item)}</li>`)
    .join("")}</ul>
</section>
${text.length > 600 ? buildContentBlockHtml("need-help-support-panel", context) : ""}`;
};

export const runRockQuickAction = (actionId: RockQuickActionId, context: ContentBlockContext, currentHtml: string): RockTransformResult => {
  const label = ROCK_QUICK_ACTIONS.find((action) => action.id === actionId)?.label ?? "Rock Content action";
  switch (actionId) {
    case "make-more-visual":
      return { label, mode: "insert", html: blockSet(["card-grid", "quote-block", "process-diagram"], context) };
    case "paragraph-to-cards":
      return { label, mode: "insert", html: cardTransform(context, currentHtml) };
    case "list-to-timeline":
      return { label, mode: "insert", html: timelineTransform(context, currentHtml) };
    case "student-friendly-scaffolding":
      return { label, mode: "insert", html: blockSet(["before-you-begin-checklist", "student-success-path", "need-help-support-panel"], context) };
    case "examples-and-non-examples":
      return { label, mode: "insert", html: blockSet(["concept-and-example-block", "myth-vs-reality-cards", "common-mistake-callout"], context) };
    case "accessibility-improvements":
      return { label, mode: "insert", html: blockSet(["accessibility-and-inclusion-panel", "technology-needed-block", "need-help-support-panel"], context) };
    case "instructor-voice":
      return { label, mode: "insert", html: blockSet(["instructor-welcome-card", "instructor-margin-note"], context) };
    case "simplify-page-layout":
      return { label, mode: "replace", html: simplifiedLayout(context, currentHtml) };
    case "canvas-homepage-ready":
      return {
        label,
        mode: "replace",
        html: blockSet(["hero-banner", "start-here-button-panel", "navigation-tile-grid", "course-journey-map", "this-week-at-a-glance", "instructor-welcome-card", "need-help-support-panel", "how-to-succeed-checklist", "course-promise-statement", "course-trailer-video-placeholder"], context)
      };
    case "start-here-page":
      return {
        label,
        mode: "replace",
        html: blockSet(["hero-banner", "start-here-button-panel", "course-promise-statement", "how-to-succeed-checklist", "student-success-path", "need-help-support-panel", "technology-needed-block", "accessibility-and-inclusion-panel"], context)
      };
    default: {
      const exhaustive: never = actionId;
      return exhaustive;
    }
  }
};
