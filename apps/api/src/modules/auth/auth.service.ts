import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { verifyPassword } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      select: { id: true, email: true, passwordHash: true, role: true },
    });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const session = await this.sessionService.createSession(user.id);

    return {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      session,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    return {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
    };
  }
}
