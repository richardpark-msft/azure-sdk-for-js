import { ServiceBusClient } from "../serviceBusClient";
import { QueueClient } from "../queueClient";
import { ReceiveMode, ServiceBusMessage } from "../serviceBusMessage";
import { MessagingError } from "@azure/core-amqp";
import { Receiver, SessionReceiver } from "../receiver";
import {
  ReceiverHandlers,
  SessionMessage,
  SettleableContext,
  SessionContext,
  CloseableThing,
  Message,
  PlainContext,
  PeekedMessage,
  QueueConsumerClientOptions,
  FetchResult,
  FetchOptions
} from "./models";
import { peekBySequenceNumber, peek } from "./utils/peekHelpers";

export class QueueConsumerClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  constructor(connectionString: string, queueName: string, options?: QueueConsumerClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
  }

  fetch(
    sessionId: string,
    mode: "PeekLock",
    options?: FetchOptions
  ): FetchResult<Message, SettleableContext>;
  fetch(
    sessionId: string,
    mode: "ReceiveAndDelete",
    options?: FetchOptions
  ): FetchResult<Message, PlainContext>;
  fetch(mode: "PeekLock", options?: FetchOptions): FetchResult<Message, SettleableContext>;
  fetch(mode: "ReceiveAndDelete", options?: FetchOptions): FetchResult<Message, PlainContext>;
  fetch(
    sessionIdOrMode1: "PeekLock" | "ReceiveAndDelete",
    modeOrOptions2?: "PeekLock" | "ReceiveAndDelete" | FetchOptions,
    options3?: FetchOptions
  ): FetchResult<Message, SettleableContext> | FetchResult<Message, PlainContext> {
    let sessionId: string | undefined;
    let mode: string;
    let options: FetchOptions | undefined;

    if (
      typeof sessionIdOrMode1 === "string" &&
      modeOrOptions2 != null &&
      typeof modeOrOptions2 === "string"
    ) {
      sessionId = sessionIdOrMode1;
      mode = modeOrOptions2;
      options = options3;
    } else {
      mode = sessionIdOrMode1;
      options = modeOrOptions2 as FetchOptions | undefined;
      sessionId = undefined;
    }

    if (options == null) {
      options = {};
    }

    let receiver: Receiver | SessionReceiver;
    const receiveMode = mode === "PeekLock" ? ReceiveMode.peekLock : ReceiveMode.receiveAndDelete;

    if (sessionId != null) {
      receiver = this._queueClient.createReceiver(receiveMode, { sessionId });
    } else {
      receiver = this._queueClient.createReceiver(receiveMode);
    }

    // TODO: this thing needs to be way more configurable than it is.
    const iterator = receiver.getMessageIterator(options.maxWaitTimeInSeconds);

    return {
      async close(): Promise<void> {
        receiver.close();
      },
      iterator,
      context: mode === "PeekLock" ? settleableContext : {}
    };
  }

  consume(
    sessionId: string,
    mode: "PeekLock",
    handlers: ReceiverHandlers<SessionMessage, SessionContext & SettleableContext>
  ): CloseableThing;
  consume(
    sessionId: string,
    mode: "ReceiveAndDelete",
    handlers: ReceiverHandlers<SessionMessage, SessionContext>
  ): CloseableThing;
  consume(mode: "PeekLock", handlers: ReceiverHandlers<Message, SettleableContext>): CloseableThing;
  consume(
    mode: "ReceiveAndDelete",
    handlers: ReceiverHandlers<Message, PlainContext>
  ): CloseableThing;
  consume(
    sessionIdOrMode: "PeekLock" | "ReceiveAndDelete" | string,
    modeOrHandlers:
      | "PeekLock"
      | "ReceiveAndDelete"
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>,
    handlers?:
      | ReceiverHandlers<SessionMessage, SessionContext>
      | ReceiverHandlers<SessionMessage, SessionContext & SettleableContext>
  ): CloseableThing {
    if (
      typeof sessionIdOrMode === "string" &&
      typeof modeOrHandlers === "string" &&
      handlers != null
    ) {
      return this._consumeWithSession(sessionIdOrMode, modeOrHandlers, handlers);
    } else if (typeof modeOrHandlers !== "string") {
      return this._consumeWithoutSession(sessionIdOrMode, modeOrHandlers);
    } else {
      throw new Error("Unhandled set of arguments");
    }
  }

  private _consumeWithoutSession(
    mode: string,
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ) {
    let receiver: Receiver;
    if (mode === "PeekLock") {
      receiver = this._createPeekLockReceiver(handlers);
    } else if (mode === "ReceiveAndDelete") {
      receiver = this._createReceiveAndDeleteReceiver(handlers);
    } else {
      throw new Error("Unhandled argument combination");
    }
    return <CloseableThing>{
      async close() {
        return receiver.close();
      }
    };
  }

  private _consumeWithSession(
    sessionId: string,
    mode: string,
    handlers: ReceiverHandlers<SessionMessage, SessionContext>
  ) {
    let receiver: SessionReceiver;
    if (mode === "PeekLock") {
      receiver = this._createPeekLockReceiverForSession(sessionId, handlers);
    } else if (mode === "ReceiveAndDelete") {
      receiver = this._createReceiveAndDeleteReceiverForSession(sessionId, handlers);
    } else {
      throw new Error("Unhandled argument combination");
    }
    return <CloseableThing>{
      async close() {
        return receiver.close();
      }
    };
  }

  async peekWithoutLock(sessionId: string, messageCount?: number): Promise<PeekedMessage[]>;
  async peekWithoutLock(
    sessionId: string,
    fromSequenceNumber: Long,
    maxMessageCount?: number
  ): Promise<PeekedMessage[]>;
  async peekWithoutLock(messageCount?: number): Promise<PeekedMessage[]>;
  async peekWithoutLock(
    fromSequenceNumber: Long,
    maxMessageCount?: number
  ): Promise<PeekedMessage[]>;
  async peekWithoutLock(
    sessionIdOrMessageCountOrSequenceNumber1?: string | number | Long,
    maxMessageCountOrSequenceNumber2?: number | Long,
    maxMessageCount3?: number
  ): Promise<PeekedMessage[]> {
    const clientContext = this._queueClient["_context"];

    if (typeof sessionIdOrMessageCountOrSequenceNumber1 === "string") {
      // session overloads
      const sessionId: string = sessionIdOrMessageCountOrSequenceNumber1;

      if (typeof maxMessageCountOrSequenceNumber2 === "object") {
        const sequenceNumber: Long = maxMessageCountOrSequenceNumber2;

        return peekBySequenceNumber(clientContext, sequenceNumber, maxMessageCount3, sessionId);
      } else {
        const maxMessageCount: number | undefined = maxMessageCountOrSequenceNumber2;
        return peek(clientContext, maxMessageCount);
      }
    } else {
      // non-session overloads
      if (typeof sessionIdOrMessageCountOrSequenceNumber1 === "object") {
        const sequenceNumber: Long = sessionIdOrMessageCountOrSequenceNumber1;
        return peekBySequenceNumber(clientContext, sequenceNumber, maxMessageCount3);
      } else {
        return peek(clientContext, sessionIdOrMessageCountOrSequenceNumber1);
      }
    }
  }

  async close() {
    await this._queueClient.close();
    await this._sbClient.close();
  }

  private _createReceiveAndDeleteReceiver(
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

  private _createReceiveAndDeleteReceiverForSession(
    sessionId: string,
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): SessionReceiver {
    const receiver = this._queueClient.createReceiver(ReceiveMode.receiveAndDelete, {
      sessionId: sessionId
    });

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

  // TODO:autocommit. Need to discuss and potentially do.
  private _createPeekLockReceiver(
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): Receiver {
    const receiver = this._queueClient.createReceiver(ReceiveMode.peekLock);
    const actualHandlers = handlers as ReceiverHandlers<Message, SettleableContext & PlainContext>;

    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: batching.
        // TODO: technically the underlying object still has the settle() and other
        // related methods. We should remove them.
        return actualHandlers.processEvents([message], settleableContext);
      },
      (error: MessagingError | Error) => {
        // TODO: I'm not sure why processError's equivalent
        // here is not async but we need to fix that.
        actualHandlers.processError(error, settleableContext);
      }
    );
    return receiver;
  }

  private _createPeekLockReceiverForSession(
    sessionId: string,
    handlers:
      | ReceiverHandlers<Message, SettleableContext & PlainContext>
      | ReceiverHandlers<Message, PlainContext>
  ): SessionReceiver {
    const receiver: SessionReceiver = this._queueClient.createReceiver(ReceiveMode.peekLock, {
      sessionId: sessionId
    });

    const actualHandlers = handlers as ReceiverHandlers<Message, SettleableContext & PlainContext>;

    receiver.registerMessageHandler(
      async (message: ServiceBusMessage) => {
        // TODO: batching.
        // TODO: technically the underlying object still has the settle() and other
        // related methods. We should remove them.
        return actualHandlers.processEvents([message], settleableContext);
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

let settleableContext: SettleableContext & PlainContext = {
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
