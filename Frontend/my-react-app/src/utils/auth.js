export function isLoggedIn() {
  try {
    const raw = localStorage.getItem('current_user')
    const obj = raw ? JSON.parse(raw) : null
    return !!obj && (!!obj.email || !!obj.id || !!obj.token)
  } catch {
    return false
  }
}

