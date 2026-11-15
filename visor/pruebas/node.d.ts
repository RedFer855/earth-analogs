declare module 'node:assert/strict' {
  function assert(value: unknown, message?: string | Error): asserts value;
  namespace assert {
    export function equal<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    export function deepEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
    export function ok(value: unknown, message?: string | Error): asserts value;
    export function notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    export function throws(fn: () => unknown, error?: RegExp, message?: string): void;
    export function match(value: string, regexp: RegExp, message?: string | Error): void;
    export function rejects(
      fn: (() => Promise<unknown>) | Promise<unknown>,
      error?: RegExp | ((err: unknown) => boolean),
      message?: string,
    ): Promise<void>;
  }
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
}
