export class CommerceDomainError extends Error {
  constructor(message: string, public readonly code: string = 'COMMERCE_ERROR') {
    super(message);
    this.name = 'CommerceDomainError';
  }
}

export class OrderValidationError extends CommerceDomainError {
  constructor(message: string) {
    super(message, 'ORDER_VALIDATION_ERROR');
    this.name = 'OrderValidationError';
  }
}

export class OrderNotFoundError extends CommerceDomainError {
  constructor(orderId: string) {
    super(`Order with ID '${orderId}' was not found.`, 'ORDER_NOT_FOUND');
    this.name = 'OrderNotFoundError';
  }
}
