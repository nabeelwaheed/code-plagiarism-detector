import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AuthenticatedRequest, AuthenticatedUser } from "./auth.types.js";

export const PUBLIC_ROUTE_KEY = "publicRoute";
export const REQUIRED_ROLES_KEY = "requiredRoles";

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const Roles = (...roles: Array<AuthenticatedUser["role"]>) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authUser;
  },
);
