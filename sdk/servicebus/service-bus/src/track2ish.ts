import { ServiceBusClientOptions, ServiceBusClient } from "./serviceBusClient";
import { QueueClient } from "./queueClient";
import { ReceiveMode, ServiceBusMessage } from "./serviceBusMessage";
import { MessagingError } from ".";
import { Receiver } from "./receiver";

// message with a body and any basic fields that exist in all message types
export interface Message {
  body: any;
}

/*
 * TODO:
 * - [ ] Where should we put management link related methods? Own class? On
 *    QueueClient directly (can be confusing - .peek() lives at the queue client
 *    but it's not what we normally want people to use.
 * - [ ] What does the surface look like in:
 */

export interface MessageBatch {
  // so subtle...so error prone!
  tryAdd(message: Message): boolean;
}

export interface SettleableMessage extends Message {
  abandon(): Promise<void>;
  complete(): Promise<void>;
  deadLetter(): Promise<void>;
  defer(): Promise<void>;
}

export interface ReceiverHandlers<MessageType> {
  processEvents(messages: MessageType[]): Promise<void>;
  // TODO: can be async
  processError(err: Error): Promise<void>;
}

export interface CloseableThing {
  close(): Promise<void>;
}

export class QueueConsumerClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
  }

  consume(mode: "PeekLock", handlers: ReceiverHandlers<SettleableMessage>): CloseableThing;
  consume(mode: "ReceiveAndDelete", handlers: ReceiverHandlers<Message>): CloseableThing;
  consume(
    mode: "PeekLock" | "ReceiveAndDelete",
    handlers: ReceiverHandlers<SettleableMessage> | ReceiverHandlers<Message>
  ): CloseableThing {
    let receiver: Receiver;

    if (mode === "PeekLock") {
      receiver = this._queueClient.createReceiver(ReceiveMode.peekLock);
      const actualHandlers = handlers as ReceiverHandlers<SettleableMessage>;

      receiver.registerMessageHandler(
        async (message: ServiceBusMessage) => {
          // TODO: batching.
          return actualHandlers.processEvents([createSettleableMessage(message)]);
        },
        (error: MessagingError | Error) => {
          // TODO: I'm not sure why processError's equivalent
          // here is not async.
          actualHandlers.processError(error);
        }
      );
    } else if (mode === "ReceiveAndDelete") {
      receiver = this._queueClient.createReceiver(ReceiveMode.receiveAndDelete);
      const actualHandlers = handlers as ReceiverHandlers<Message>;

      receiver.registerMessageHandler(
        async (message: ServiceBusMessage) => {
          // TODO: batching.
          return actualHandlers.processEvents([{ body: message.body }]);
        },
        (error: MessagingError | Error) => {
          // TODO: I'm not sure why processError's equivalent
          // here is not async.
          actualHandlers.processError(error);
        }
      );
    } else {
      throw new Error("Unhandled argument combination");
    }

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

// ...maybe. These aren't really "production" methods - they're things for diagnostics (typically)
export interface DiagnosticsClient {
  peek(): Promise<void>;
  abandon(): Promise<void>;
}

// TODO: do we need to share connections? Is that preferable?
export interface QueueProducerClient {
  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions): any;

  createBatch(): Promise<MessageBatch>;
  sendBatch(batch: MessageBatch): Promise<void>;
  // ? offer?
  send(message: Message): Promise<void>;
  schedule(message: Message): number;

  // dual methods for batch vs non-batch?
  sendBatch(batch: MessageBatch): Promise<void>;
  scheduleBatch(batch: MessageBatch): Promise<number>;
  cancelSchedule(scheduleId: number): Promise<void>;
}

// TODO: sessions live with the life of the client?

function createSettleableMessage(origMessage: ServiceBusMessage): SettleableMessage {
  return {
    async abandon(): Promise<void> {
      return origMessage.abandon();
    },
    async complete(): Promise<void> {
      return origMessage.complete();
    },
    body: origMessage.body
  };
}
