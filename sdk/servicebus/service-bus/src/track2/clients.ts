import { ServiceBusClientOptions, ServiceBusClient } from "../serviceBusClient";
import { QueueClient } from "../queueClient";
import { ReceiveMode, ServiceBusMessage, ReceivedMessageInfo } from "../serviceBusMessage";
import { MessagingError } from "@azure/core-amqp";
import { Receiver } from "../receiver";
import {
  ReceiverHandlers,
  SessionMessage,
  SettleableContext,
  SessionContext,
  CloseableThing,
  Message,
  PlainContext,
  MessageBatch,
  PeekedMessage
} from "./models";

/**
 * Methods for diagnostics and troubleshooting. Not for general
 * production use as they aren't performant and bypass most of the
 * server-side guarantees that make service bus useful (like ensuring
 * only a single producer has consumed a message, etc..)
 */
export interface DiagnosticsClient {
  // TODO: put all the $Management related methods here (probably)
  // TODO: `ReceivedMessageInfo` is a name that I think we use in event hubs
  //   but it seems odd to have 'info' in the name since it is actually a
  //   message. Perhaps MessageWithInfo or something more specific to indicate
  //   the actual "extra-ness" this message has?
  peek(maxMessageCount?: number): Promise<PeekedMessage[]>;

  peekBySequenceNumber(
    fromSequenceNumber: Long,
    maxMessageCount?: number
  ): Promise<PeekedMessage[]>;
}

export class QueueConsumerClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
  }

  // TODO: can you specify a mode when listening to a session?
  consumeSession(
    sessionId: string,
    mode: "PeekLock",
    handlers: ReceiverHandlers<SessionMessage, SessionContext & SettleableContext>
  ): CloseableThing;
  consumeSession(
    sessionId: string,
    mode: "ReceiveAndDelete",
    handlers: ReceiverHandlers<SessionMessage, SessionContext>
  ): CloseableThing;
  consumeSession(
    sessionId: string,
    mode: "PeekLock" | "ReceiveAndDelete",
    handlers: ReceiverHandlers<SessionMessage, SessionContext>
  ): CloseableThing {
    console.log(sessionId, handlers);
    return {
      async close() {
        return Promise.resolve();
      }
    };
  }

  consume(mode: "PeekLock", handlers: ReceiverHandlers<Message, SettleableContext>): CloseableThing;
  consume(
    mode: "ReceiveAndDelete",
    handlers: ReceiverHandlers<Message, PlainContext>
  ): CloseableThing;
  consume(
    mode: "PeekLock" | "ReceiveAndDelete" | string,
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): CloseableThing {
    let receiver: Receiver;

    if (mode === "PeekLock") {
      receiver = this.createPeekLockReceiver(handlers);
    } else if (mode === "ReceiveAndDelete") {
      receiver = this.createReceiveAndDeleteReceiver(handlers);
    } else {
      throw new Error("Unhandled argument combination");
    }

    return <CloseableThing>{
      async close() {
        return receiver.close();
      }
    };
  }

  private createReceiveAndDeleteReceiver(
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): Receiver {
    const receiver = this._queueClient.createReceiver(ReceiveMode.receiveAndDelete);
    const actualHandlers = handlers as ReceiverHandlers<Message, PlainContext>;
    const context: PlainContext = {};
    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: do real batching - right not we're just doing "batch" size of 1
        return actualHandlers.processEvents([message], context);
      },
      (error: MessagingError | Error) => {
        // TODO: I'm not sure why processError's equivalent
        // here is not async.
        actualHandlers.processError(error, context);
      }
    );
    return receiver;
  }

  private createPeekLockReceiver(
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): Receiver {
    const receiver = this._queueClient.createReceiver(ReceiveMode.peekLock);
    const actualHandlers = handlers as ReceiverHandlers<Message, SettleableContext & PlainContext>;
    const settleableContext: SettleableContext & PlainContext = {
      // TODO: move these methods off of ServiceBusMessage and we'll
      // just do the work directly in the context. This is just a hack
      // to present the right interface.
      async abandon(message: Message): Promise<void> {
        return (message as ServiceBusMessage).abandon();
      },
      async complete(message: Message): Promise<void> {
        return (message as ServiceBusMessage).complete();
      },
      async deadLetter(message: Message): Promise<void> {
        return (message as ServiceBusMessage).deadLetter();
      },
      async defer(message: Message): Promise<void> {
        return (message as ServiceBusMessage).defer();
      }
    };
    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: batching.
        return actualHandlers.processEvents([createSettleableMessage(message)], settleableContext);
      },
      (error: MessagingError | Error) => {
        // TODO: I'm not sure why processError's equivalent
        // here is not async but we need to fix that.
        actualHandlers.processError(error, settleableContext);
      }
    );
    return receiver;
  }
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
