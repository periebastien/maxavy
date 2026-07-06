const AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/forgot-password']

function isAuthPath(path) {
  return AUTH_PATHS.some(p => path.startsWith(p))
}

function handleUnauthorized(path) {
  if (isAuthPath(path)) return
  localStorage.removeItem('token')
  window.location.href = '/login'
}

async function request(method, path, body) {
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) handleUnauthorized(path)
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.message || 'Erreur serveur'), { status: res.status })
  return data
}

async function upload(path, formData) {
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { method: 'POST', headers, body: formData })
  if (res.status === 401) handleUnauthorized(path)
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.message || 'Erreur serveur'), { status: res.status })
  return data
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
  upload,
}

export default api
