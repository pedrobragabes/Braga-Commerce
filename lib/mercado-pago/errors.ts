export class MercadoPagoIntegrationError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 500) { super(message); }
}
