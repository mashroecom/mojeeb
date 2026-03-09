declare module '@paypal/checkout-server-sdk' {
  export interface PayPalOrderResponse {
    id: string;
    status: string;
    purchase_units: Array<{
      reference_id?: string;
      amount: {
        currency_code: string;
        value: string;
      };
      payments?: {
        captures?: Array<{
          id: string;
          status: string;
          amount: {
            currency_code: string;
            value: string;
          };
        }>;
      };
    }>;
    links?: Array<{
      href: string;
      rel: string;
      method: string;
    }>;
  }

  export class PayPalHttpClient {
    constructor(environment: any);
    execute(request: any): Promise<{ result: any }>;
  }

  export namespace core {
    export class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class PayPalHttpClient {
      constructor(environment: any);
      execute(request: any): Promise<{ result: any }>;
    }
  }

  export namespace orders {
    export class OrdersCreateRequest {
      constructor();
      prefer(preference: string): void;
      requestBody(body: any): void;
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: any): void;
    }
    export class OrdersGetRequest {
      constructor(orderId: string);
    }
  }
}
