export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "professor" | "student";
}

export interface AuthenticatedRequest {
  authUser?: AuthenticatedUser;
  authSessionId?: string;
  cookies?: Record<string, string>;
}
