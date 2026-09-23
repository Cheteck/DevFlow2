import { describe, expect, it } from "vitest";
import { Container } from "./container";

class DependencyService {
  name = "dep";
}

class ParentService {
  constructor(public dep: DependencyService) {}
}

describe("Container Constructor Injection Suite", () => {
  it("resolves class constructors automatically", () => {
    const container = new Container();
    // TypeScript efface les types des paramètres à l'exécution et la config
    // n'active pas `emitDecoratorMetadata` : le container ne peut pas deviner
    // `DependencyService` depuis la signature de `ParentService`. L'injection
    // se déclare explicitement via `bind` avec une factory.
    container.bind(DependencyService, () => new DependencyService());
    container.bind(
      ParentService,
      (c) => new ParentService(c.resolve(DependencyService)),
    );
    const resolved = container.resolve(ParentService);
    expect(resolved).toBeInstanceOf(ParentService);
    expect(resolved.dep).toBeInstanceOf(DependencyService);
  });
});
