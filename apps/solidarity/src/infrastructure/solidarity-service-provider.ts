import type { Container, ServiceProvider, Router, HttpRequest, HttpResponse } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { SolidarityService } from "./solidarity-service.js";
import { PostgresSolidarityRepository } from "./postgres-solidarity-repository.js";

export interface SolidarityAppServiceProviderOptions {
  databasePort?: DatabasePort;
}

export class SolidarityAppServiceProvider implements ServiceProvider {
  constructor(private readonly options: SolidarityAppServiceProviderOptions = {}) {}

  register(container: Container): void {
    const postgresRepo = this.options.databasePort
      ? new PostgresSolidarityRepository(this.options.databasePort)
      : undefined;

    const solidarityService = new SolidarityService(postgresRepo);

    container.instance(SolidarityService, solidarityService);

    if (postgresRepo) {
      container.instance("postgresSolidarityRepository", postgresRepo);
    }
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const service = container.resolve(SolidarityService);

    router.get("/solidarity/incidents", async (_req: HttpRequest): Promise<HttpResponse> => {
      const data = await service.getIncidentsAsync();
      return { statusCode: 200, body: data };
    });
    router.get("/solidarity/needs", async (_req: HttpRequest): Promise<HttpResponse> => {
      const data = await service.getNeedsAsync();
      return { statusCode: 200, body: data };
    });
    router.get("/solidarity/donations", async (_req: HttpRequest): Promise<HttpResponse> => {
      const data = await service.getDonationsAsync();
      return { statusCode: 200, body: data };
    });
    router.get("/solidarity/hubs", async (_req: HttpRequest): Promise<HttpResponse> => {
      const data = await service.getHubsAsync();
      return { statusCode: 200, body: data };
    });
    router.get("/solidarity/missions", async (_req: HttpRequest): Promise<HttpResponse> => {
      const data = await service.getMissionsAsync();
      return { statusCode: 200, body: data };
    });
  }
}
