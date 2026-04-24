import type { BillStatus } from '@/generated/prisma/enums';

export class InvalidTransitionError extends Error {
  readonly fromStatus: BillStatus;
  readonly toStatus: BillStatus;

  constructor(fromStatus: BillStatus, toStatus: BillStatus) {
    super(`Cannot transition bill from ${fromStatus} to ${toStatus}`);
    this.name = 'InvalidTransitionError';
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

export class UnauthorizedError extends Error {
  readonly action: string;

  constructor(action: string) {
    super(`Not authorized to ${action}`);
    this.name = 'UnauthorizedError';
    this.action = action;
  }
}

export function isBillServiceError(e: unknown): e is InvalidTransitionError | UnauthorizedError {
  return e instanceof InvalidTransitionError || e instanceof UnauthorizedError;
}
