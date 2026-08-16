import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a camelCase string into a snake_case string.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Transforms an entire object's keys from camelCase to snake_case.
 */

export function keysToSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToSnakeCase(item));
  }

  if (obj instanceof Date) {
    return obj;
  }

  // Handle explicit structural guard for Prisma Decimal prototypes at runtime
  if (obj && typeof obj === "object" && "toFixed" in obj && "d" in obj) {
    return obj;
  }

  const snakeObj: Record<string, any> = {};

  Object.keys(obj).forEach((key) => {
    const snakeKey = toSnakeCase(key);
    snakeObj[snakeKey] = keysToSnakeCase(obj[key]);
  });

  return snakeObj;
}

// ========================================================
// 2. COMPILE-TIME TYPESCRIPT TYPE (Uppercase K)
// ========================================================

export type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uncapitalize<T>}${CamelToSnakeCase<U>}`
    : `${Uncapitalize<T>}_${CamelToSnakeCase<Uncapitalize<U>>}`
  : S;

export type KeysToSnakeCase<T> = T extends Date
  ? T
  : T extends { toFixed: any; d: any }
    ? T
    : T extends Array<infer U>
      ? Array<KeysToSnakeCase<U>>
      : T extends object
        ? { [K in keyof T as CamelToSnakeCase<Extract<K, string>>]: KeysToSnakeCase<T[K]> }
        : T;
