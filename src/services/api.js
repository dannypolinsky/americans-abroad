// API Service for Americans Abroad frontend

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export async function fetchPlayers() {
  const response = await fetch(`${API_BASE}/players`)
  if (!response.ok) throw new Error('Failed to fetch players')
  return response.json()
}

export async function fetchLeagues() {
  const response = await fetch(`${API_BASE}/leagues`)
  if (!response.ok) throw new Error('Failed to fetch leagues')
  return response.json()
}

export async function fetchMatches() {
  const response = await fetch(`${API_BASE}/matches`)
  if (!response.ok) throw new Error('Failed to fetch matches')
  return response.json()
}

export async function fetchPlayerMatch(playerId) {
  const response = await fetch(`${API_BASE}/matches/${playerId}`)
  if (!response.ok) throw new Error('Failed to fetch player match')
  return response.json()
}

export async function refreshMatches() {
  const response = await fetch(`${API_BASE}/matches/refresh`, {
    method: 'POST'
  })
  if (!response.ok) throw new Error('Failed to refresh matches')
  return response.json()
}

export async function fetchStatus() {
  const response = await fetch(`${API_BASE}/status`)
  if (!response.ok) throw new Error('Failed to fetch status')
  return response.json()
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) throw new Error('API health check failed')
  return response.json()
}
