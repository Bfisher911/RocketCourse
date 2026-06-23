// POST /.netlify/functions/blog-manage — Super-Admin blog CRUD. Public reads happen via RLS (anon
// can SELECT published posts); this owns the writes (create/update/publish/unpublish/archive/delete)
// with slug-uniqueness validation and audit logging. Content is stored as Markdown and rendered
// safely on the client, so no raw HTML is persisted.

import { json } from "./_shared/http";
import { getSupabaseAdmin } from "./_shared/supabaseAdmin";
import { createAuditLog, requireSuperAdmin } from "./_shared/guards";
import { slugify } from "./_shared/workspaceSync";

const STATUSES = ["draft", "scheduled", "published", "archived"];

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const guard = await requireSuperAdmin(request);
  if (!guard.ok) return guard.response;
  const actor = guard.user;
  const admin = getSupabaseAdmin();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Body must be JSON." });
  }
  const action = String(body.action ?? "save");

  if (action === "delete") {
    const id = String(body.id ?? "");
    if (!id) return json(400, { error: "id is required." });
    await admin.from("blog_posts").delete().eq("id", id);
    await createAuditLog({ actorUserId: actor.id, actorEmail: actor.email, eventType: "blog_post_deleted", targetType: "blog_post", targetId: id, request });
    return json(200, { ok: true });
  }

  // save (create or update)
  const id = body.id ? String(body.id) : null;
  const title = String(body.title ?? "").trim();
  if (!title) return json(400, { error: "A title is required." });

  const slug = slugify(String(body.slug ?? "").trim() || title);
  const status = STATUSES.includes(String(body.status)) ? String(body.status) : "draft";
  const excerpt = String(body.excerpt ?? "").slice(0, 400);
  const contentMarkdown = String(body.contentMarkdown ?? "");
  const coverImageUrl = body.coverImageUrl ? String(body.coverImageUrl).slice(0, 600) : null;
  const seoTitle = body.seoTitle ? String(body.seoTitle).slice(0, 120) : null;
  const seoDescription = body.seoDescription ? String(body.seoDescription).slice(0, 300) : null;

  // Slug uniqueness (excluding self).
  const { data: clash } = await admin.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
  if (clash && clash.id !== id) return json(409, { error: `The slug "${slug}" is already in use.` });

  // Resolve published_at by status.
  let publishedAt: string | null = null;
  const providedPublishedAt = body.publishedAt ? new Date(String(body.publishedAt)) : null;
  if (status === "published") {
    let existingPublished: string | null = null;
    if (id) {
      const { data } = await admin.from("blog_posts").select("published_at").eq("id", id).maybeSingle();
      existingPublished = (data?.published_at as string) ?? null;
    }
    publishedAt = (providedPublishedAt && !Number.isNaN(providedPublishedAt.getTime()) ? providedPublishedAt.toISOString() : null) || existingPublished || new Date().toISOString();
  } else if (status === "scheduled") {
    if (!providedPublishedAt || Number.isNaN(providedPublishedAt.getTime())) {
      return json(400, { error: "A scheduled post needs a future publish date." });
    }
    publishedAt = providedPublishedAt.toISOString();
  }

  const row: Record<string, unknown> = {
    title,
    slug,
    excerpt,
    content_markdown: contentMarkdown,
    cover_image_url: coverImageUrl,
    status,
    seo_title: seoTitle,
    seo_description: seoDescription,
    published_at: publishedAt
  };

  let savedId = id;
  if (id) {
    const { error } = await admin.from("blog_posts").update(row).eq("id", id);
    if (error) return json(500, { error: error.message });
  } else {
    row.author_user_id = actor.id;
    const { data, error } = await admin.from("blog_posts").insert(row).select("id").single();
    if (error) return json(500, { error: error.message });
    savedId = (data?.id as string) ?? null;
  }

  if (status === "published") {
    await createAuditLog({ actorUserId: actor.id, actorEmail: actor.email, eventType: "blog_post_published", targetType: "blog_post", targetId: savedId, metadata: { slug }, request });
  } else if (status === "archived") {
    await createAuditLog({ actorUserId: actor.id, actorEmail: actor.email, eventType: "blog_post_archived", targetType: "blog_post", targetId: savedId, metadata: { slug }, request });
  }

  return json(200, { ok: true, id: savedId, slug, status });
};
