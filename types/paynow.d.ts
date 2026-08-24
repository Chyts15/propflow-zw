// The `paynow` package ships no type declarations — minimal ambient typing
// for the surface area PropFlow actually uses (see lib/payments/paynow.ts).
declare module "paynow" {
  export interface PaynowPayment {
    reference: string;
    authEmail?: string;
    add(name: string, price: number): void;
    total(): number;
    info(): string;
  }

  export interface PaynowInitResponse {
    success: boolean;
    error?: string;
    redirectUrl?: string;
    pollUrl?: string;
    instructions?: string;
    hasRedirect?: boolean;
  }

  export interface PaynowStatusResponse {
    success: boolean;
    status: string;
    amount?: string;
    reference?: string;
    paynowReference?: string;
    hash?: string;
    paid(): boolean;
  }

  export class Paynow {
    constructor(integrationId?: string, integrationKey?: string);
    resultUrl: string;
    returnUrl: string;
    integrationId: string;
    integrationKey: string;
    createPayment(reference: string, authEmail?: string): PaynowPayment;
    send(payment: PaynowPayment): Promise<PaynowInitResponse>;
    sendMobile(
      payment: PaynowPayment,
      phone: string,
      method: "ecocash" | "onemoney",
    ): Promise<PaynowInitResponse>;
    pollTransaction(pollUrl: string): Promise<PaynowStatusResponse>;
    verifyHash(values: Record<string, string>): boolean;
  }
}
