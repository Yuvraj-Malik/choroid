// Thin wrapper around the FastAPI backend (proxied at /api in dev).
const BASE = import.meta.env.VITE_API_URL || ''

async function json(res) {
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).detail || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

export const api = {
  reference: () => fetch(`${BASE}/api/reference`).then(json),

  upload: (file, kind) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    return fetch(`${BASE}/api/images`, { method: 'POST', body: fd }).then(json)
  },

  imageUrl: (id, size = 1000) => `${BASE}/api/images/${id}?size=${size}`,

  register: (body) =>
    fetch(`${BASE}/api/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(json),

  analyze: (body) =>
    fetch(`${BASE}/api/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(json),
}

export const IMAGE_SIZE = 4000
export const DEFAULT_MM_PER_PX = 2.54 / 96
