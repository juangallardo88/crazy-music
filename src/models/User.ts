export interface SessionUser {
  id: string
  username: string
  email: string
}

export interface User extends SessionUser {
  passwordHash: string
  createdAt: string
}
