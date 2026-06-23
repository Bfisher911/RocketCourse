// Minimal, safe Markdown → HTML renderer for blog content. Everything is HTML-escaped FIRST, then a
// small subset of Markdown is applied, so no author-supplied HTML or script can survive. Links are
// restricted to safe protocols (http/https/mailto) or root-relative paths. No image embedding from
// arbitrary markdown (cover images are a separate, validated field).

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SAFE_URL = /^(https?:\/\/|mailto:|\/)/i;

const inline = (text: string): string => {
  let out = text;
  // links [label](url) — label may contain inline formatting handled after
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    if (!SAFE_URL.test(url)) return label;
    const rel = url.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${rel}>${label}</a>`;
  });
  // inline code
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  // bold then italic
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  return out;
};

/** Render a Markdown string to a safe HTML string (for dangerouslySetInnerHTML). */
export const renderMarkdown = (markdown: string): string => {
  const escaped = escapeHtml(markdown.replace(/\r\n/g, "\n"));
  const lines = escaped.split("\n");
  const html: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      html.push(`<p>${inline(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    // code fence
    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushPara();
        closeList();
        inCode = true;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      closeList();
      i += 1;
      continue;
    }
    // headings
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length + 1; // h2..h5 (reserve h1 for the page title)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    // hr
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushPara();
      closeList();
      html.push("<hr />");
      i += 1;
      continue;
    }
    // blockquote
    if (/^&gt;\s?/.test(trimmed)) {
      flushPara();
      closeList();
      html.push(`<blockquote>${inline(trimmed.replace(/^&gt;\s?/, ""))}</blockquote>`);
      i += 1;
      continue;
    }
    // unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      i += 1;
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inline(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
      i += 1;
      continue;
    }
    // paragraph text
    closeList();
    paraBuf.push(trimmed);
    i += 1;
  }
  if (inCode) html.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
  flushPara();
  closeList();
  return html.join("\n");
};
