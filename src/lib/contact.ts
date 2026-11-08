/** Shared between the Contact page and its API routes. */
export const CONTACT_MAX_FILES = 5;
export const CONTACT_MAX_FILE_MB = 50;
export const CONTACT_TITLE_MAX = 120;
export const CONTACT_MESSAGE_MAX = 5000;
export const CONTACT_FILE_TYPES = ["image/*", "video/*"];

export interface ContactAttachment {
  name: string;
  type: string;
  size: number;
  /** Public URL in blob storage; null when stored only locally (dev). */
  url: string | null;
}

export const isMediaType = (t: string) => t.startsWith("image/") || t.startsWith("video/");
