// `ws` ships no bundled types and we only pass it to supabase-js as a Realtime transport shim
// (never used server-side). Declare it as `any` so the functions typecheck (tsconfig.functions.json)
// is a usable gate without adding a devDependency.
declare module "ws";
