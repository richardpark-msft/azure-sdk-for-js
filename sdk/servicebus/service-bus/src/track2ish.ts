import { ConnectionConfig, TokenCredential, SharedKeyCredential } from "@azure/core-amqp";
import { ServiceBusClientOptions, ServiceBusClient } from "./serviceBusClient";
import { QueueClient } from "./queueClient";
import { Receiver } from "./receiver";
import { Sender } from "./sender";
import { ReceiveMode, ServiceBusMessage } from "./serviceBusMessage";
import { MessagingError } from ".";

export interface Message {
  body: any;
}

export interface SettleableMessage extends Message {
  abandon(): Promise<void>;
  complete(): Promise<void>;
}

export interface ReceiverHandlers<MessageType> {
  processEvents(messages: MessageType[]): Promise<void>;
  processError(err: Error): Promise<void>;
}

export interface CloseableThing {
  close(): Promise<void>;
}

export class QueueReceiverClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
  }

  createSender(): Sender {
    return this._queueClient.createSender();
  }
}

export class QueueSenderClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
  }

  createPeekLockReceiver(handlers: ReceiverHandlers<SettleableMessage>): CloseableThing {
    const receiver = this._queueClient.createReceiver(ReceiveMode.peekLock);

    // message: ServiceBusMessage
    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: batch at some point
        return handlers.processEvents([
          {
            async abandon(): Promise<void> {
              return message.abandon();
            },
            async complete(): Promise<void> {
              return message.complete();
            },
            body: message.body
          }
        ]);
      },
      (error: MessagingError | Error) => {
        // TODO: I'm not sure why processError's equivalent
        // here is not async.
        handlers.processError(error);
      }
    );

    return {
      async close() {
        return receiver.close();
      }
    };
  }

  createReceiveAndDeleteReceiver(handlers: ReceiverHandlers<Message>): CloseableThing {
    const receiver = this._queueClient.createReceiver(ReceiveMode.peekLock);

    // message: ServiceBusMessage
    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: batch at some point
        return handlers.processEvents([
          {
            body: message.body
          }
        ]);
      },
      (error: MessagingError | Error) => {
        // TODO: I'm not sure why processError's equivalent
        // here is not async.
        handlers.processError(error);
      }
    );

    return {
      async close() {
        return receiver.close();
      }
    };
  }
}
