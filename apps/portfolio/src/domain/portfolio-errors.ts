export class VendableNotFoundError extends Error {
  constructor(id: string) {
    super(`Vendable [${id}] not found.`);
    this.name = "VendableNotFoundError";
  }
}

export class DuplicateVendableReferenceError extends Error {
  constructor(reference: string) {
    super(`Vendable with reference [${reference}] already exists.`);
    this.name = "DuplicateVendableReferenceError";
  }
}

export class InvalidWorkflowTransitionError extends Error {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Invalid workflow transition from [${currentStatus}] to [${targetStatus}].`,
    );
    this.name = "InvalidWorkflowTransitionError";
  }
}

export class SelfRelationError extends Error {
  constructor(vendableId: string) {
    super(
      `Vendable [${vendableId}] cannot establish a semantic relation to itself.`,
    );
    this.name = "SelfRelationError";
  }
}

export class DuplicateVariantReferenceError extends Error {
  constructor(variantRef: string) {
    super(`Duplicate variant reference [${variantRef}] detected in vendable.`);
    this.name = "DuplicateVariantReferenceError";
  }
}

export class OperationalKeyForbiddenError extends Error {
  constructor(key: string) {
    super(`Portfolio cannot store commercial or operational data (forbidden key: '${key}')`);
    this.name = "OperationalKeyForbiddenError";
  }
}
