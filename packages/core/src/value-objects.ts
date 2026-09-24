/**
 * @mosaix/core — Value Objects (Money & Timestamp)
 * DATA-06: Unified money representation and timestamping.
 */

export class Money {
  constructor(
    public readonly amountInCents: number,
    public readonly currency: string = "EUR"
  ) {
    if (!Number.isInteger(amountInCents) || amountInCents < 0) {
      throw new Error(`Invalid monetary amount in cents: ${amountInCents}`);
    }
    if (typeof currency !== "string" || currency.length !== 3) {
      throw new Error(`Invalid ISO 4217 currency code: ${currency}`);
    }
  }

  static fromCents(cents: number, currency = "EUR"): Money {
    return new Money(Math.round(cents), currency.toUpperCase());
  }

  static fromAmount(amount: number, currency = "EUR"): Money {
    return new Money(Math.round(amount * 100), currency.toUpperCase());
  }

  get amount(): number {
    return this.amountInCents / 100;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add amounts in different currencies: ${this.currency} vs ${other.currency}`);
    }
    return new Money(this.amountInCents + other.amountInCents, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract amounts in different currencies: ${this.currency} vs ${other.currency}`);
    }
    const result = this.amountInCents - other.amountInCents;
    if (result < 0) {
      throw new Error(`Resulting monetary amount cannot be negative`);
    }
    return new Money(result, this.currency);
  }

  toJSON(): { amountInCents: number; currency: string; formatted: string } {
    return {
      amountInCents: this.amountInCents,
      currency: this.currency,
      formatted: `${this.amount.toFixed(2)} ${this.currency}`,
    };
  }
}

export class Timestamp {
  public readonly date: Date;

  constructor(value?: string | number | Date) {
    if (!value) {
      this.date = new Date();
    } else if (value instanceof Date) {
      this.date = value;
    } else if (typeof value === "number") {
      this.date = new Date(value);
    } else {
      this.date = new Date(value);
    }

    if (isNaN(this.date.getTime())) {
      throw new Error(`Invalid timestamp value: ${value}`);
    }
  }

  static now(): Timestamp {
    return new Timestamp();
  }

  toIso(): string {
    return this.date.toISOString();
  }

  toEpochMs(): number {
    return this.date.getTime();
  }

  toJSON(): string {
    return this.toIso();
  }
}
