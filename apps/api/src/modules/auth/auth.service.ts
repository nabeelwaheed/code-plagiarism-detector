import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { ProfessorSignupDto } from "./dto/professor-signup.dto.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async login(payload: LoginDto) {
    const normalizedEmail = normalizeEmail(payload.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
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

  async signupProfessor(payload: ProfessorSignupDto) {
    const normalizedEmail = normalizeEmail(payload.email);
    const password = payload.password.trim();

    if (!normalizedEmail) {
      throw new BadRequestException("Email is required");
    }

    if (password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("An account with that email already exists");
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role: "PROFESSOR",
        firstName: payload.firstName?.trim() || null,
        lastName: payload.lastName?.trim() || null,
        title: payload.title?.trim() || null,
        department: payload.department?.trim() || null,
      },
      select: { id: true, email: true, role: true },
    });

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
