import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser, Public } from "./auth.decorators.js";
import { LoginDto } from "./dto/login.dto.js";
import type { AuthenticatedUser } from "./auth.types.js";
import { SessionService } from "./session.service.js";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Public()
  @Post("login")
  async login(@Body() payload: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.login(payload);
    reply.setCookie(apiRuntimeConfig.session.cookieName, result.session.rawToken, {
      httpOnly: true,
      secure: apiRuntimeConfig.session.secure,
      sameSite: apiRuntimeConfig.session.sameSite,
      domain: apiRuntimeConfig.session.domain,
      path: "/",
      expires: result.session.expiresAt,
    });

    return {
      userId: result.userId,
      email: result.email,
      role: result.role,
      expiresAt: result.session.expiresAt,
    };
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const rawToken = reply.request.cookies[apiRuntimeConfig.session.cookieName];
    if (rawToken) {
      await this.sessionService.revokeSessionByToken(rawToken);
    }

    reply.clearCookie(apiRuntimeConfig.session.cookieName, {
      httpOnly: true,
      secure: apiRuntimeConfig.session.secure,
      sameSite: apiRuntimeConfig.session.sameSite,
      domain: apiRuntimeConfig.session.domain,
      path: "/",
    });

    return { ok: true, userId: user.id };
  }

  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
