/**
 * @mosaix/container — DI Decorators
 */

import type { InjectionToken } from "./container";

export function Injectable() {
  return function (target: unknown) {
    return target;
  };
}

export function Inject(_token: InjectionToken) {
  return function (target: unknown, _propertyKey: string | symbol, _parameterIndex: number) {
    return target;
  };
}
