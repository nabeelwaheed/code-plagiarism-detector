import { Body, Controller, Delete, Get, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser, Public, Roles } from "./auth.decorators.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { ProfessorSignupDto } from "./dto/professor-signup.dto.js";
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
    setSessionCookie(reply, result.session.rawToken, result.session.expiresAt);

    return {
      userId: result.userId,
      email: result.email,
      role: result.role,
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
      department: result.department,
      expiresAt: result.session.expiresAt,
    };
  }

  @Public()
  @Post("professor-signup")
  async professorSignup(
    @Body() payload: ProfessorSignupDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.signupProfessor(payload);
    setSessionCookie(reply, result.session.rawToken, result.session.expiresAt);

    return {
      userId: result.userId,
      email: result.email,
      role: result.role,
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
      department: result.department,
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

    clearSessionCookie(reply);

    return { ok: true, userId: user.id };
  }

  @Get("me")
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title,
      department: user.department,
    };
  }

  @Roles("professor")
  @Post("change-password")
  async changePassword(
    @Body() payload: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.authService.changePassword(user.id, payload);
    return { ok: true };
  }

  @Roles("professor")
  @Delete("account")
  async deleteOwnAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.deleteProfessorAccount(user.id);
    clearSessionCookie(reply);
    return { ok: true };
  }
}

function setSessionCookie(reply: FastifyReply, rawToken: string, expiresAt: Date) {
  reply.setCookie(apiRuntimeConfig.session.cookieName, rawToken, {
    httpOnly: true,
    secure: apiRuntimeConfig.session.secure,
    sameSite: apiRuntimeConfig.session.sameSite,
    domain: apiRuntimeConfig.session.domain,
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(apiRuntimeConfig.session.cookieName, {
    httpOnly: true,
    secure: apiRuntimeConfig.session.secure,
    sameSite: apiRuntimeConfig.session.sameSite,
    domain: apiRuntimeConfig.session.domain,
    path: "/",
  });
}
