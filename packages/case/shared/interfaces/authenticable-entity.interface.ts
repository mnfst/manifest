// We use this interface instead of the one from TypeORM because we want to be able to use it in the client app.
export interface AuthenticableEntity {
  id: number
  email: string
  password: string
}
