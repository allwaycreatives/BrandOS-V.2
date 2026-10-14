// File types people may upload. A pattern ending in * matches any type that starts with the text before it.
export const ALLOWED_UPLOAD_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'text/*',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]

export function isAllowedUploadType(type: string) {
  const t = type.split(';')[0].trim().toLowerCase()
  return ALLOWED_UPLOAD_TYPES.some((p) => (p.endsWith('*') ? t.startsWith(p.slice(0, -1)) : t === p))
}
