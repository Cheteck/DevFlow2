import type { Router, HttpRequest, HttpResponse } from "@mosaix/sdk";
import type { BookingService, CreateSlotInput, CreateReservationInput } from "../domain/booking.model.js";

export class BookingController {
  constructor(private readonly service: BookingService) {}

  mount(router: Router): void {
    // List slots
    router.get("/slots", async (req: HttpRequest): Promise<HttpResponse> => {
      const url = new URL(req.path || "/", "http://localhost");
      const providerId = url.searchParams.get("providerId") || undefined;
      const status = url.searchParams.get("status") || undefined;

      const slots = this.service.listSlots({ providerId, status });
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, slots }),
      };
    });

    // Get single slot
    router.get("/slots/:id", async (req: HttpRequest): Promise<HttpResponse> => {
      const slotId = req.params?.id;
      if (!slotId) {
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: "Identifiant de créneau manquant" }),
        };
      }

      const slot = this.service.getSlot(slotId);
      if (!slot) {
        return {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: `Créneau [${slotId}] introuvable` }),
        };
      }

      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, slot }),
      };
    });

    // Create slot
    router.post("/slots", async (req: HttpRequest): Promise<HttpResponse> => {
      try {
        const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}) as Partial<CreateSlotInput>;

        if (!body.providerId || !body.serviceName || !body.startTime || !body.endTime) {
          return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ success: false, error: "Champs requis : providerId, serviceName, startTime, endTime" }),
          };
        }

        const slot = this.service.createSlot({
          providerId: body.providerId,
          serviceName: body.serviceName,
          startTime: body.startTime,
          endTime: body.endTime,
          capacity: body.capacity,
          location: body.location,
        });

        return {
          statusCode: 201,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: true, slot }),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur interne lors de la création du créneau";
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: message }),
        };
      }
    });

    // Create reservation
    router.post("/reservations", async (req: HttpRequest): Promise<HttpResponse> => {
      try {
        const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}) as Partial<CreateReservationInput>;

        if (!body.slotId || !body.customerId || !body.customerName || !body.customerEmail) {
          return {
            statusCode: 400,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ success: false, error: "Champs requis : slotId, customerId, customerName, customerEmail" }),
          };
        }

        const reservation = this.service.createReservation({
          slotId: body.slotId,
          customerId: body.customerId,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
        });

        return {
          statusCode: 201,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: true, reservation }),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de la réservation";
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: message }),
        };
      }
    });

    // List reservations
    router.get("/reservations", async (req: HttpRequest): Promise<HttpResponse> => {
      const url = new URL(req.path || "/", "http://localhost");
      const slotId = url.searchParams.get("slotId") || undefined;
      const customerId = url.searchParams.get("customerId") || undefined;

      const reservations = this.service.listReservations({ slotId, customerId });
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true, reservations }),
      };
    });

    // Cancel reservation
    router.post("/reservations/:id/cancel", async (req: HttpRequest): Promise<HttpResponse> => {
      const reservationId = req.params?.id;
      if (!reservationId) {
        return {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: "Identifiant de réservation manquant" }),
        };
      }

      try {
        const reservation = this.service.cancelReservation(reservationId);
        return {
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: true, reservation }),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur lors de l'annulation";
        return {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ success: false, error: message }),
        };
      }
    });
  }
}
