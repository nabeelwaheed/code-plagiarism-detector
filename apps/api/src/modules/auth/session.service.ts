import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { createHash, randomBytes } from "node:crypto";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import type { AuthenticatedUser } from "./auth.types.js";

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + apiRuntimeConfig.session.ttlMs);

    const session = await this.prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return {
      sessionId: session.id,
      rawToken,
      expiresAt,
    };
  }

  async validateSessionToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException("Session is invalid or expired");
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      sessionId: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role.toLowerCase() as AuthenticatedUser["role"],
      },
    };
  }

  async revokeSessionByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    await this.prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  async revokeExpiredSessions() {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });
  }
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}
