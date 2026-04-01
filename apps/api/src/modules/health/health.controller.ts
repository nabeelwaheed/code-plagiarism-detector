import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.decorators.js";
import { HealthService } from "./health.service.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  getLive() {
    return {
      status: "ok",
      service: "api",
    };
  }

  @Get("ready")
  async getReady() {
    return this.healthService.getReadiness();
  }
}
