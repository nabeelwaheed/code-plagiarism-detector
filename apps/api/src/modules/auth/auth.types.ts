export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "professor" | "student";
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  department?: string | null;
}

export interface AuthenticatedRequest {
  authUser?: AuthenticatedUser;
  authSessionId?: string;
  cookies?: Record<string, string>;
}
