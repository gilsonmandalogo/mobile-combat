export class ErrorUndefinedProperty extends Error {
  constructor(property: string) {
    super(`Cannot access "${property}" property before it's defined`)
  }
}
