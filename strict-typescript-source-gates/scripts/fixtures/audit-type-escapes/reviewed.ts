const literal = { state: "ok" } as const;
const tuple = <const>["ok"];

// [SAFETY]: fixture validates that a nearby review label is recognized.
const asserted = literal as { readonly state: "ok" };

// [SAFETY]: fixture-only invariant.
const state = asserted.state!;

class Reviewed {
  // [TRUSTME]: fixture-only framework initialization contract.
  field!: string;
}

// [SAFETY]: fixture predicate deliberately checks the complete fixture shape.
function isReviewed(value: unknown): value is Reviewed {
  return value instanceof Reviewed;
}

// [SAFETY]: fixture assertion delegates to the complete predicate above.
function assertReviewed(value: unknown): asserts value is Reviewed {
  if (!isReviewed(value)) throw new TypeError("not Reviewed");
}

// [SAFETY]: fixture overload dispatch is exhaustive for its two signatures.
function convert(value: string): number;
function convert(value: number): string;
function convert(value: string | number): string | number {
  return typeof value === "string" ? value.length : String(value);
}

// @ts-expect-error fixture intentionally calls the wrong signature -- [TRUSTME]: fixture inventory only
convert(true);

interface ReviewedCallable {
  // [SAFETY]: fixture call-signature overloads are checked by their implementation adapter.
  (value: string): number;
  (value: number): string;
}

interface ReviewedMethodBoundary {
  // [SAFETY]: fixture records a deliberately method-shaped assignable boundary.
  handle(value: string): void;
}

interface ReviewedFactory {
  // [SAFETY]: fixture records a deliberately generic construct boundary.
  new <T>(value: T): { value: T };
}

// [SAFETY]: fixture records a deliberately open callback-arity contract.
type ReviewedOpenArity = (...values: string[]) => void;

const reviewedTransport = { json<T>(): T { throw new Error("fixture"); } };
// [SAFETY]: fixture records a caller-supplied generic runtime claim.
const reviewedPayload = reviewedTransport.json<{ id: string }>();

// eslint-disable-next-line no-console -- [TRUSTME]: fixture-only lint suppression
console.log(state, tuple, assertReviewed, convert, reviewedPayload);

// [TRUSTME]: fixture deliberately exercises interface declaration merging.
interface ReviewedMerge { left: string }
interface ReviewedMerge { right: number }

// [TRUSTME]: fixture patch and runtime/type declarations are co-located.
Array.prototype.fixtureReviewed = function fixtureReviewed(): number { return this.length; };

// [TRUSTME]: fixture augmentation matches fixtureReviewed above.
declare global {
  interface Array<T> {
    // [SAFETY]: fixture records the method-shaped augmented boundary.
    fixtureReviewed(): number;
  }
}

// [TRUSTME]: fixture-only Node global patch clue.
Object.defineProperty(global, "fixtureReviewed", { value: true });

export {};
