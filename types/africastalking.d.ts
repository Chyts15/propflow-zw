// The `africastalking` package ships no type declarations — minimal ambient
// typing for the SMS service surface PropFlow uses (see lib/sms/africas-talking.ts).
declare module "africastalking" {
  export interface SmsRecipient {
    number: string;
    cost: string;
    status: string;
    statusCode: number;
    messageId: string;
  }

  export interface SmsSendResponse {
    SMSMessageData: {
      Message: string;
      Recipients: SmsRecipient[];
    };
  }

  export interface SmsService {
    send(options: {
      to: string | string[];
      message: string;
      senderId?: string;
    }): Promise<SmsSendResponse>;
  }

  export interface AfricasTalkingServices {
    SMS: SmsService;
  }

  export default function AfricasTalking(credentials: {
    apiKey: string;
    username: string;
  }): AfricasTalkingServices;
}
