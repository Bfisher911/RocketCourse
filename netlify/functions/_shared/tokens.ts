// Secure invite / join-link tokens. We hand the raw token to the user (in a link) and store ONLY
// its SHA-256 hash, so a leak of the database never reveals usable tokens. Uses Web Crypto, which
// is a global in the Netlify Functions (Node 20) runtime.

declare const crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: { digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> };
};
declare const btoa: (data: string) => string;
declare class TextEncoder {
  encode(input: string): Uint8Array;
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** A 256-bit URL-safe random token (the secret handed to the user). */
export const generateToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

/** SHA-256 hex hash of a token (what we persist). */
export const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
};
