// JWT helpers — decode the base64url payload to inspect the `exp` claim.
// No external dependency: the backend signs the token, the frontend only reads `exp`.

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { exp?: number }
    if (!payload.exp) return false // no exp claim — let the backend reject it
    return payload.exp * 1000 <= Date.now()
  } catch {
    return true // malformed token — treat as expired
  }
}
