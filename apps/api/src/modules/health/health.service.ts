import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Redis } from "ioredis";
import { apiRuntimeConfig } from "../../config/runtime-config.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadiness() {
    const redis = new Redis(apiRuntimeConfig.redisUrl);

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");
      const redisResponse = await redis.ping();

      return {
        status: "ok",
        checks: {
          database: "ok",
          redis: redisResponse === "PONG" ? "ok" : "unexpected",
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "readiness check failed";
      throw new ServiceUnavailableException({
        status: "error",
        message,
      });
    } finally {
      await redis.quit();
    }
  }
}
