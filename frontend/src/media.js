// Builds a full URL for an uploaded media path (org logo, event photo).
// In production this is set via VITE_MEDIA_BASE_URL (see .env.production).
// Locally it's left empty so requests are relative and go through the
// Vite dev server proxy to the local backend (see vite.config.js), which
// serves /media/* itself since there's no Nginx running locally.
export const mediaUrl = (path) =>
    path ? `${import.meta.env.VITE_MEDIA_BASE_URL || ''}${path}` : path
