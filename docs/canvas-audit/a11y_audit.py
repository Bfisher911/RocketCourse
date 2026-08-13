#!/usr/bin/env python3
"""
Offline WCAG 2.1 AA audit for Canvas course HTML.

The captured course is styled entirely with inline `style=` attributes and no external CSS, so an
ancestor-walking resolver reproduces the browser's computed values faithfully: text colour comes
from the nearest ancestor that sets `color`, and the effective background from the nearest ancestor
that sets an opaque `background`/`background-color`. That is what makes an offline contrast check
trustworthy here — it would not be on a page with a stylesheet.

Usage:  python3 a11y_audit.py <dump_dir> [--json out.json]
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys
from html.parser import HTMLParser

# --------------------------------------------------------------------------------------
# colour
# --------------------------------------------------------------------------------------

NAMED = {
    "white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0), "blue": (0, 0, 255),
    "green": (0, 128, 0), "gray": (128, 128, 128), "grey": (128, 128, 128),
    "transparent": None, "inherit": None, "currentcolor": None,
}


def parse_color(value: str):
    """-> (r, g, b) for opaque colours, None for transparent/unknown/translucent."""
    if not value:
        return None
    v = value.strip().lower()
    if v in NAMED:
        return NAMED[v]
    m = re.match(r"#([0-9a-f]{3}|[0-9a-f]{6})$", v)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.match(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$", v)
    if m:
        a = float(m.group(4)) if m.group(4) is not None else 1.0
        # A translucent layer does not establish the background on its own.
        if a < 0.85:
            return None
        return tuple(int(float(m.group(i))) for i in (1, 2, 3))
    return None


def luminance(rgb) -> float:
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg) -> float:
    l1, l2 = luminance(fg), luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def hexs(rgb) -> str:
    return "#" + "".join(f"{c:02x}" for c in rgb)


# --------------------------------------------------------------------------------------
# a tiny DOM
# --------------------------------------------------------------------------------------

VOID = {"img", "br", "hr", "input", "meta", "link", "source", "area", "col"}


class Node:
    __slots__ = ("tag", "attrs", "style", "children", "parent", "text")

    def __init__(self, tag, attrs, parent):
        self.tag = tag
        self.attrs = attrs
        self.style = parse_style(attrs.get("style", ""))
        self.children = []
        self.parent = parent
        self.text = []


def parse_style(value: str) -> dict:
    out = {}
    for part in value.split(";"):
        if ":" in part:
            k, _, v = part.partition(":")
            out[k.strip().lower()] = v.strip()
    return out


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", {}, None)
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, {k.lower(): (v or "") for k, v in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, {k.lower(): (v or "") for k, v in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data.strip():
            self.stack[-1].text.append(data.strip())


def build(html: str) -> Node:
    b = Builder()
    b.feed(html)
    return b.root


def walk(node: Node):
    for child in node.children:
        yield child
        yield from walk(child)


# --------------------------------------------------------------------------------------
# computed-ish style resolution
# --------------------------------------------------------------------------------------

def resolved_color(node: Node):
    """Nearest ancestor (inclusive) that sets a usable `color`; Canvas body default otherwise."""
    n = node
    while n is not None:
        c = parse_color(n.style.get("color", ""))
        if c:
            return c
        n = n.parent
    return (43, 45, 48)  # Canvas default body text


def resolved_background(node: Node):
    """Nearest ancestor (inclusive) with an opaque background; page white otherwise."""
    n = node
    while n is not None:
        for prop in ("background-color", "background"):
            raw = n.style.get(prop, "")
            if not raw:
                continue
            # `background:` shorthand may carry gradients/images; take the first colour token.
            m = re.search(r"(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))", raw)
            if m:
                c = parse_color(m.group(1))
                if c:
                    return c
        n = n.parent
    return (255, 255, 255)


def font_px(node: Node) -> float:
    n = node
    while n is not None:
        fs = n.style.get("font-size", "")
        m = re.match(r"([\d.]+)px", fs.strip())
        if m:
            return float(m.group(1))
        n = n.parent
    return 16.0


def is_bold(node: Node) -> bool:
    n = node
    while n is not None:
        w = n.style.get("font-weight", "").strip()
        if w:
            if w in ("bold", "bolder"):
                return True
            if w.isdigit():
                return int(w) >= 700
        if n.tag in ("strong", "b", "th"):
            return True
        n = n.parent
    return False


# --------------------------------------------------------------------------------------
# checks
# --------------------------------------------------------------------------------------

VAGUE_LINKS = {"here", "click here", "this", "read more", "more", "link", "learn more", "this page", "click"}


def audit(label: str, html: str, report: list):
    root = build(html)

    seen_pairs = set()
    for node in walk(root):
        own_text = " ".join(node.text).strip()
        if len(own_text) < 3:
            continue
        fg, bg = resolved_color(node), resolved_background(node)
        px, bold = font_px(node), is_bold(node)
        large = px >= 24 or (px >= 18.66 and bold)
        need = 3.0 if large else 4.5
        ratio = contrast(fg, bg)
        key = (hexs(fg), hexs(bg), large)
        if ratio < need and key not in seen_pairs:
            seen_pairs.add(key)
            report.append({
                "check": "contrast",
                "severity": "blocker" if ratio < 3.0 else "major",
                "source": label,
                "detail": f"{hexs(fg)} on {hexs(bg)} = {ratio:.2f}:1, needs {need}:1 "
                          f"({'large' if large else 'normal'} text, {px:.0f}px{', bold' if bold else ''}).",
                "evidence": own_text[:90],
            })

    # link text that means nothing out of context
    for node in walk(root):
        if node.tag != "a":
            continue
        text = " ".join(t for n in [node] for t in n.text) or " ".join(
            " ".join(c.text) for c in walk(node))
        t = re.sub(r"\s+", " ", text).strip().lower().rstrip(".:")
        if t in VAGUE_LINKS:
            report.append({"check": "vague-link-text", "severity": "major", "source": label,
                           "detail": f'Link text "{t}" does not describe its destination.',
                           "evidence": node.attrs.get("href", "")[:90]})

    # aria references that point nowhere
    ids = {n.attrs["id"] for n in walk(root) if n.attrs.get("id")}
    for node in walk(root):
        for attr in ("aria-labelledby", "aria-describedby"):
            for target in node.attrs.get(attr, "").split():
                if target not in ids:
                    report.append({"check": "aria-dangling", "severity": "major", "source": label,
                                   "detail": f'{attr} points at id "{target}", which is not in this document.',
                                   "evidence": node.tag})

    # meaning carried only by an emoji/glyph with no text
    for node in walk(root):
        txt = " ".join(node.text)
        if txt and not re.search(r"[A-Za-z0-9]", txt) and re.search(r"[←-⯿\U0001F000-\U0001FAFF]", txt):
            if node.attrs.get("aria-hidden") != "true":
                report.append({"check": "glyph-only-meaning", "severity": "minor", "source": label,
                               "detail": "Element's only content is a symbol with no text and no aria-hidden.",
                               "evidence": txt[:40]})

    # tiny type
    for node in walk(root):
        if " ".join(node.text).strip() and font_px(node) < 12:
            report.append({"check": "tiny-text", "severity": "minor", "source": label,
                           "detail": f"Text rendered at {font_px(node):.0f}px.",
                           "evidence": " ".join(node.text)[:60]})
            break


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dump")
    ap.add_argument("--json")
    args = ap.parse_args()
    d = args.dump

    docs = {}
    idx_path = os.path.join(d, "pages_index.json")
    if os.path.exists(idx_path):
        for p in json.load(open(idx_path)):
            if os.path.exists(p["file"]):
                docs[f"page:{p['url']}"] = open(p["file"]).read()
    syl = os.path.join(d, "syllabus_body.html")
    if os.path.exists(syl):
        docs["syllabus-tab"] = open(syl).read()
    for name, key, field in (("assignments.json", "name", "description"),
                             ("discussions.json", "title", "message"),
                             ("announcements.json", "title", "message")):
        path = os.path.join(d, name)
        if os.path.exists(path):
            for item in json.load(open(path)):
                docs[f"{name[:-5]}:{item[key]}"] = item.get(field) or ""

    report: list = []
    for label, html in docs.items():
        audit(label, html, report)

    order = {"blocker": 0, "major": 1, "minor": 2}
    report.sort(key=lambda r: (order[r["severity"]], r["check"]))
    if args.json:
        json.dump(report, open(args.json, "w"), indent=1)

    counts = collections.Counter(r["severity"] for r in report)
    bycheck = collections.Counter((r["severity"], r["check"]) for r in report)
    print(f"documents audited: {len(docs)}")
    for (sev, chk), n in sorted(bycheck.items(), key=lambda x: (order[x[0][0]], -x[1])):
        print(f"  {sev:8} {n:>4}  {chk}")
    print(f"\nTOTAL blocker={counts['blocker']} major={counts['major']} minor={counts['minor']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
