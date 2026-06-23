// Blog reads. Public reads are RLS-restricted to published (and past publish-time) posts; a Super
// Admin's session reads everything (for preview + the manager). Writes go through the blog-manage
// Netlify Function (see platformClient.blogManage).

import { getSupabaseClient, supabaseConfig } from "./supabaseClient";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  coverImageUrl: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

const isLocal = (): boolean => !supabaseConfig.isConfigured;

/* eslint-disable @typescript-eslint/no-explicit-any */
const map = (r: any): BlogPost => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  excerpt: r.excerpt ?? "",
  contentMarkdown: r.content_markdown ?? "",
  coverImageUrl: r.cover_image_url ?? null,
  status: r.status,
  seoTitle: r.seo_title ?? null,
  seoDescription: r.seo_description ?? null,
  publishedAt: r.published_at ?? null,
  authorUserId: r.author_user_id ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const loadPublishedPosts = async (): Promise<BlogPost[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data } = await client
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const now = Date.now();
  return (data ?? [])
    .map(map)
    .filter((p) => !p.publishedAt || new Date(p.publishedAt).getTime() <= now);
};

export const loadPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  if (isLocal()) return null;
  const client = await getSupabaseClient();
  if (!client) return null;
  const { data } = await client.from("blog_posts").select("*").eq("slug", slug).maybeSingle();
  return data ? map(data) : null;
};

/** Super-Admin manager view: all posts (RLS lets a super admin read every status). */
export const loadAllPostsAdmin = async (): Promise<BlogPost[]> => {
  if (isLocal()) return [];
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data } = await client.from("blog_posts").select("*").order("updated_at", { ascending: false });
  return (data ?? []).map(map);
};
