import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply } from "fastify";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { PUBLIC_ROUTE_KEY } from "./auth.decorators.js";
import { SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const rawToken = request.cookies?.[apiRuntimeConfig.session.cookieName];

    if (!rawToken) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const session = await this.sessionService.validateSessionToken(rawToken);
      request.authUser = session.user;
      request.authSessionId = session.sessionId;
      return true;
    } catch (error) {
      reply.clearCookie(apiRuntimeConfig.session.cookieName, {
        path: "/",
        domain: apiRuntimeConfig.session.domain,
      });
      throw error;
    }
  }
}
