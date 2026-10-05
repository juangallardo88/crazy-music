import type { SessionUser, User } from '../models/User'

const USERS_KEY = 'crazy-music-users'
const SESSION_KEY = 'crazy-music-session'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const readUsers = (): User[] => {
  try {
    const storedUsers = localStorage.getItem(USERS_KEY)
    return storedUsers ? (JSON.parse(storedUsers) as User[]) : []
  } catch {
    return []
  }
}

const writeUsers = (users: User[]): void => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const hashPassword = async (password: string): Promise<string> => {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const AuthService = {
  async registerUser(input: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }): Promise<{ success: boolean; message: string }> {
    const username = input.username.trim()
    const email = normalizeEmail(input.email)

    if (!username || !email || !input.password || !input.confirmPassword) {
      return { success: false, message: 'Todos los campos son obligatorios.' }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Ingresa un correo electrónico válido.' }
    }

    if (input.password.length < 6) {
      return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' }
    }

    if (input.password !== input.confirmPassword) {
      return { success: false, message: 'La contraseña y la confirmación no coinciden.' }
    }

    const users = readUsers()
    if (users.some((user) => normalizeEmail(user.email) === email)) {
      return { success: false, message: 'Ya existe una cuenta registrada con ese correo.' }
    }

    const passwordHash = await hashPassword(input.password)
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    }

    users.push(newUser)
    writeUsers(users)

    return { success: true, message: 'Registro exitoso. Ahora puedes iniciar sesión.' }
  },

  async loginUser(input: {
    email: string
    password: string
  }): Promise<{ success: boolean; message: string; user?: SessionUser }> {
    const email = normalizeEmail(input.email)
    const passwordHash = await hashPassword(input.password)

    if (!email || !input.password) {
      return { success: false, message: 'Correo y contraseña son obligatorios.' }
    }

    const users = readUsers()
    const user = users.find((item) => normalizeEmail(item.email) === email)

    if (!user) {
      return { success: false, message: 'No existe una cuenta con ese correo.' }
    }

    if (user.passwordHash !== passwordHash) {
      return { success: false, message: 'La contraseña es incorrecta.' }
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
      }),
    )

    return {
      success: true,
      message: 'Inicio de sesión exitoso.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    }
  },

  getSessionUser(): SessionUser | null {
    try {
      const sessionData = localStorage.getItem(SESSION_KEY)
      return sessionData ? (JSON.parse(sessionData) as SessionUser) : null
    } catch {
      return null
    }
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY)
  },
}
