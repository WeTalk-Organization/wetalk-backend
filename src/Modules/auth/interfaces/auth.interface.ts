export interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  accessToken: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}
