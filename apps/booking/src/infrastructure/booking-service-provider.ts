import type { Container, ServiceProvider, Router } from "@mosaix/sdk";
import type { DatabasePort } from "@mosaix/ports-database";
import { BookingService } from "../domain/booking.model.js";
import { BookingController } from "./booking-controller.js";
import { PostgresBookingRepository } from "./postgres-booking-repository.js";

export interface BookingAppServiceProviderOptions {
  databasePort?: DatabasePort;
}

export class BookingAppServiceProvider implements ServiceProvider {
  private bookingService: BookingService;
  private postgresRepo?: PostgresBookingRepository;

  constructor(private readonly options: BookingAppServiceProviderOptions = {}) {
    if (this.options.databasePort) {
      this.postgresRepo = new PostgresBookingRepository(this.options.databasePort);
    }
    this.bookingService = new BookingService(this.postgresRepo);
  }

  register(container: Container): void {
    if (this.postgresRepo) {
      container.instance("postgresBookingRepository", this.postgresRepo);
    }
    container.instance(BookingService, this.bookingService);
    container.instance("bookingService", this.bookingService);
    container.singleton(BookingController, (c) => new BookingController(c.resolve<BookingService>(BookingService)));
    container.instance("bookingController", container.resolve(BookingController));
  }

  boot(container: Container, router?: Router): void {
    if (!router) return;
    const controller = container.resolve<BookingController>(BookingController);
    controller.mount(router);
  }
}

