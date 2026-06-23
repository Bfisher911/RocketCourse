// Super-Admin blog manager: list + editor. Writes go through the blog-manage function (slug
// uniqueness, status transitions, audit). Preview renders Markdown through the safe renderer.

import { useEffect, useState } from "react";
import { ArrowLeft, Eye, FileText, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { blogManage } from "../../services/platformClient";
import { loadAllPostsAdmin, type BlogPost } from "../../services/blogClient";
import { renderMarkdown } from "../../utils/markdown";

type Draft = Partial<BlogPost>;
const blank = (): Draft => ({ title: "", slug: "", excerpt: "", contentMarkdown: "", status: "draft", coverImageUrl: "", seoTitle: "", seoDescription: "" });

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => setPosts(await loadAllPostsAdmin());
  useEffect(() => {
    void reload();
  }, []);

  const update = (patch: Draft) => setEditing((cur) => ({ ...(cur ?? {}), ...patch }));

  const save = async (status?: string) => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await blogManage("save", {
        id: editing.id,
        title: editing.title,
        slug: editing.slug,
        excerpt: editing.excerpt,
        contentMarkdown: editing.contentMarkdown,
        coverImageUrl: editing.coverImageUrl,
        status: status ?? editing.status,
        seoTitle: editing.seoTitle,
        seoDescription: editing.seoDescription,
        publishedAt: editing.publishedAt
      });
      setEditing(null);
      setPreview(false);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await blogManage("delete", { id: editing.id });
      setEditing(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <section className="overview-card blog-editor">
        <header className="overview-card-head">
          <button type="button" className="ghost-button" onClick={() => { setEditing(null); setPreview(false); }}>
            <ArrowLeft size={14} /> Back to posts
          </button>
          <button type="button" className="ghost-button" onClick={() => setPreview((p) => !p)}>
            <Eye size={14} /> {preview ? "Edit" : "Preview"}
          </button>
        </header>

        {error && <p className="intake-ai-error">{error}</p>}

        {preview ? (
          <article className="blog-article">
            <h1>{editing.title || "Untitled"}</h1>
            <div className="blog-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(editing.contentMarkdown ?? "") }} />
          </article>
        ) : (
          <div className="blog-form">
            <label>Title<input value={editing.title ?? ""} onChange={(e) => update({ title: e.target.value })} /></label>
            <label>Slug<input value={editing.slug ?? ""} placeholder="auto from title" onChange={(e) => update({ slug: e.target.value })} /></label>
            <label>Excerpt<textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => update({ excerpt: e.target.value })} /></label>
            <label>Cover image URL<input value={editing.coverImageUrl ?? ""} onChange={(e) => update({ coverImageUrl: e.target.value })} /></label>
            <label>Content (Markdown)<textarea rows={14} value={editing.contentMarkdown ?? ""} onChange={(e) => update({ contentMarkdown: e.target.value })} /></label>
            <div className="blog-form-row">
              <label>SEO title<input value={editing.seoTitle ?? ""} onChange={(e) => update({ seoTitle: e.target.value })} /></label>
              <label>Status
                <select value={editing.status ?? "draft"} onChange={(e) => update({ status: e.target.value as BlogPost["status"] })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <label>SEO description<textarea rows={2} value={editing.seoDescription ?? ""} onChange={(e) => update({ seoDescription: e.target.value })} /></label>
            {editing.status === "scheduled" && (
              <label>Publish at
                <input
                  type="datetime-local"
                  value={editing.publishedAt ? editing.publishedAt.slice(0, 16) : ""}
                  onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
            )}
          </div>
        )}

        <div className="blog-editor-actions">
          <button type="button" className="secondary" disabled={busy || !editing.title} onClick={() => void save("draft")}>
            {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save draft
          </button>
          <button type="button" className="primary" disabled={busy || !editing.title} onClick={() => void save("published")}>
            <Send size={14} /> Publish
          </button>
          {editing.id && (
            <>
              <button type="button" className="ghost-button" disabled={busy} onClick={() => void save("archived")}>
                Archive
              </button>
              <button type="button" className="ghost-button danger" disabled={busy} onClick={() => void remove()}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="overview-card">
      <header className="overview-card-head">
        <span className="hp-eyebrow"><FileText size={14} /> Blog manager</span>
        <button type="button" className="primary" onClick={() => setEditing(blank())}>
          <Plus size={15} /> New post
        </button>
      </header>
      <ul className="blog-admin-list">
        {posts.map((p) => (
          <li key={p.id}>
            <span className="blog-admin-title">
              <strong>{p.title}</strong>
              <span className={`ws-status ${p.status}`}>{p.status}</span>
              <small>/blog/{p.slug}</small>
            </span>
            <button type="button" className="ghost-button" onClick={() => setEditing(p)}>
              Edit
            </button>
          </li>
        ))}
        {posts.length === 0 && <li className="blog-muted">No posts yet. Create your first RocketCourse post.</li>}
      </ul>
    </section>
  );
}
