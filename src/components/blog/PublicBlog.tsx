// Public, SEO-friendly blog. Index lists published posts; the detail page renders one post by slug.
// Reads are RLS-restricted to published posts (a Super Admin additionally sees drafts, shown with a
// preview badge). Markdown is rendered through the safe renderer — no author HTML survives.

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Newspaper } from "lucide-react";
import { LogoMark } from "../brand";
import { loadPostBySlug, loadPublishedPosts, type BlogPost } from "../../services/blogClient";
import { renderMarkdown } from "../../utils/markdown";
import { SITE_ORIGIN } from "../../seo";

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

export function PublicBlogIndex({ onOpenPost }: { onOpenPost: (slug: string) => void }) {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadPublishedPosts().then((p) => {
      if (active) setPosts(p);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="page-shell blog-index">
      <header className="blog-head">
        <span className="hp-eyebrow">
          <Newspaper size={14} /> RocketCourse Blog
        </span>
        <h1>Ideas for building better Canvas courses</h1>
        <p>Practical guides on course design, AI, and instructional design — from the team behind RocketCourse.</p>
      </header>

      {posts === null ? (
        <p className="blog-muted">Loading posts…</p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <LogoMark size={48} decorative className="empty-state-mark" />
          <h2>No posts yet</h2>
          <p>New RocketCourse writing is on the way. Check back soon.</p>
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((post) => (
            <button key={post.id} type="button" className="blog-card" onClick={() => onOpenPost(post.slug)}>
              {post.coverImageUrl ? (
                <span className="blog-card-cover" style={{ backgroundImage: `url(${post.coverImageUrl})` }} aria-hidden="true" />
              ) : (
                <span className="blog-card-cover blog-card-cover--placeholder" aria-hidden="true">
                  <LogoMark size={40} decorative />
                </span>
              )}
              <span className="blog-card-body">
                {post.publishedAt && (
                  <span className="blog-card-date">
                    <CalendarDays size={13} /> {formatDate(post.publishedAt)}
                  </span>
                )}
                <strong>{post.title}</strong>
                <span className="blog-card-excerpt">{post.excerpt}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

export function PublicBlogPost({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [post, setPost] = useState<BlogPost | null | "missing">(null);

  useEffect(() => {
    let active = true;
    void loadPostBySlug(slug).then((p) => {
      if (!active) return;
      setPost(p ?? "missing");
      if (p) {
        document.title = `${p.seoTitle || p.title} — RocketCourse Blog`;
        const desc = p.seoDescription || p.excerpt;
        let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        if (desc) meta.setAttribute("content", desc);
        let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement("link");
          canonical.setAttribute("rel", "canonical");
          document.head.appendChild(canonical);
        }
        canonical.setAttribute("href", `${SITE_ORIGIN}/blog/${p.slug}`);
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <main id="main-content" tabIndex={-1} className="page-shell blog-post">
      <button type="button" className="ghost-button blog-back" onClick={onBack}>
        <ArrowLeft size={15} /> All posts
      </button>

      {post === null ? (
        <p className="blog-muted">Loading…</p>
      ) : post === "missing" ? (
        <div className="empty-state">
          <h2>Post not found</h2>
          <p>This post may have been unpublished or moved.</p>
        </div>
      ) : (
        <article className="blog-article">
          {post.status !== "published" && (
            <p className="blog-preview-badge">Preview — this post is {post.status}, visible only to admins.</p>
          )}
          {post.coverImageUrl && (
            <div className="blog-article-cover" style={{ backgroundImage: `url(${post.coverImageUrl})` }} aria-hidden="true" />
          )}
          {post.publishedAt && (
            <span className="blog-card-date">
              <CalendarDays size={14} /> {formatDate(post.publishedAt)}
            </span>
          )}
          <h1>{post.title}</h1>
          {/* Safe: renderMarkdown escapes all input and only emits a known subset of tags. */}
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMarkdown) }} />
        </article>
      )}
    </main>
  );
}
