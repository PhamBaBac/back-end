import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  shopId: string;
  role: Role;
  type?: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    shopId: string;
  };
  shop: {
    id: string;
    name: string;
    code: string;
    plan: string;
  };
  tokens: AuthTokens;
}
