const source: unknown = "value";
const fakeReviewLabel = "[SAFETY]: strings are not review comments";
const asserted = source as string;
// SAFETY: legacy unbracketed labels must not count as review registration.
const legacyAsserted = source as number;
const length = asserted.length!;

class Unreviewed { field!: string }
function isUnreviewed(value: unknown): value is Unreviewed { return value instanceof Unreviewed }
function assertUnreviewed(value: unknown): asserts value is Unreviewed { if (!isUnreviewed(value)) throw new Error("bad"); }
function parse(value: string): number;
function parse(value: number): string;
function parse(value: string | number): string | number { return typeof value === "string" ? value.length : String(value) }

interface UnreviewedCallable {
  (value: string): number;
  (value: number): string;
}

interface UnreviewedMethodBoundary { handle(value: string): void }
interface UnreviewedFactory { new <T>(value: T): { value: T } }
type UnreviewedOpenArity = (...values: string[]) => void;
const unreviewedTransport = { json<T>(): T { throw new Error("fixture"); } };
const unreviewedPayload = unreviewedTransport.json<{ id: string }>();

interface UnreviewedMerge { left: string }
interface UnreviewedMerge { right: number }

// @ts-ignore intentional unreviewed fixture
parse(false);
// eslint-disable-next-line no-console, no-debugger
console.log(length, fakeReviewLabel, legacyAsserted, unreviewedPayload);
Array.prototype.unreviewedPatch = () => 1;
global.unreviewedPatch = true;
// [SAFETY]: the wrong label category must not approve a global monkey patch.
global.safetyCannotApprovePatch = true;
Object.setPrototypeOf(Unreviewed, null);

/* eslint-disable */
/* eslint no-console: off */

declare global { interface Array<T> { unreviewedPatch(): number } }
export {};
