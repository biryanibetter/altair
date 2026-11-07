export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL
  if (!value) throw new Error('DATABASE_URL is not configured')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL')
  }
  if (!url.password || decodeURIComponent(url.password) === 'YOUR-DATABASE-PASSWORD') {
    throw new Error('DATABASE_URL requires a real database password')
  }
  return value
}
