import { ServiceBusClient } from '../serviceBusClient';
import { QueueClient, ReceiveMode, SessionReceiver, ServiceBusMessage, MessagingError } from '..';
import { SessionInfo, QueueSessionReceiverClientOptions, FetchOptions, FetchResult, Message, SettleableContext, PlainContext, ReceiverHandlers, Closeable, PeekedMessage } from './models';

export class QueueSessionReceiverClientImpl {
    // TODO: temporary until I gut the other clients and use their guts directly here.
    private _sbClient: ServiceBusClient;
    private _queueClient: QueueClient;
    private _sessionInfo: SessionInfo;
  
    constructor(queueConnectionString: string, options: QueueSessionReceiverClientOptions);
    constructor(
      serviceBusConnectionString: string,
      queueName: string,
      options?: QueueSessionReceiverClientOptions
    );
    constructor(
      queueOrServiceBusConnectionString1: string,
      queueNameOrOptions2?: string | QueueSessionReceiverClientOptions,
      options3?: QueueSessionReceiverClientOptions
    ) {
      if (typeof queueNameOrOptions2 === "string" && options3 != null) {
        const serviceBusConnectionString = queueOrServiceBusConnectionString1;
        const queueName = queueNameOrOptions2;
        const options: QueueSessionReceiverClientOptions = options3;
  
        // TODO: this isn't "correct" for this session based receiver - we need to hold onto the connection
        // so we don't accidentally explode the # of connections the user opens up. Sessions tend to have 
        // a bit more of an explosion than other use-cases.
        // These will be cached in `options.session.cache`
        this._sbClient = new ServiceBusClient(serviceBusConnectionString, options);
        this._queueClient = this._sbClient.createQueueClient(queueName);
        this._sessionInfo = options.session;
      } else if (queueNameOrOptions2 != null && typeof queueNameOrOptions2 === "object") {
        const queueConnectionString = queueOrServiceBusConnectionString1;
        const options: QueueSessionReceiverClientOptions = queueNameOrOptions2;
  
        // snag the entity name from the connection string
        const entityPathMatch = queueConnectionString.match(/^.+EntityPath=(.+?);{0,1}$/);
  
        if (entityPathMatch!.length !== 2) {
          throw new Error("Invalid queue connection string - no EntityPath");
        }
  
        this._sbClient = new ServiceBusClient(queueConnectionString, options);
        this._queueClient = this._sbClient.createQueueClient(entityPathMatch![1]);
        this._sessionInfo = options.session;
      } else {
        throw new Error("Unhandled arguments");
      }
    }
  
    createMessageIterator(
      mode: "PeekLock",
      options?: FetchOptions
    ): FetchResult<Message, SettleableContext>;
    createMessageIterator(
      mode: "ReceiveAndDelete",
      options?: FetchOptions
    ): FetchResult<Message, PlainContext>;
    createMessageIterator(
      mode: "PeekLock" | "ReceiveAndDelete",
      options?: FetchOptions
    ): FetchResult<Message, PlainContext> | FetchResult<Message, SettleableContext> {
      if (options == null) {
        options = {};
      }
  
      const receiveMode = mode === "PeekLock" ? ReceiveMode.peekLock : ReceiveMode.receiveAndDelete;
      let receiver = this._queueClient.createReceiver(receiveMode, {
        sessionId: this._sessionInfo.id
      })
  
      // TODO: this thing needs to be way more configurable than it is.
      // options.maxWaitTimeInMs
      const iterator = receiver.getMessageIterator();
  
      return {
        [Symbol.asyncIterator](): AsyncIterableIterator<Message> {
          return iterator;
        },
        next(): Promise<IteratorResult<Message>> {
          return iterator.next();
        },
        async close(): Promise<void> {
          return receiver.close();
        },
        context: mode === "PeekLock" ? settleableContext : {}
      };
    }
  
    streamMessagesToHandler(
      mode: "PeekLock",
      handlers: ReceiverHandlers<Message, SettleableContext>
    ): Closeable;
    streamMessagesToHandler(
      mode: "ReceiveAndDelete",
      handlers: ReceiverHandlers<Message, PlainContext>
    ): Closeable;
    streamMessagesToHandler(
      mode1: "PeekLock" | "ReceiveAndDelete",
      handlers2:
        | ReceiverHandlers<Message, SettleableContext & PlainContext>
        | ReceiverHandlers<Message, PlainContext>
    ): Closeable {
      if (mode1 == "PeekLock") {      
        return this._createPeekLockReceiverForSession(this._sessionInfo.id, handlers2);
      } else if (mode1 == "ReceiveAndDelete") {
        return this._createReceiveAndDeleteReceiverForSession(this._sessionInfo.id, handlers2);
      } else {
        throw new Error("Unhandled set of arguments");
      }
    }
  
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
      return [];
    }
  
    async close() {
      await this._queueClient.close();
      await this._sbClient.close();
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
          return actualHandlers.processMessage(message, settleableContext);
        },
        (error: MessagingError | Error) => {
          // TODO: I'm not sure why processError's equivalent
          // here is not async but we need to fix that.
          actualHandlers.processError(error, settleableContext);
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
          return actualHandlers.processMessage(message, context);
        },
        (error: MessagingError | Error) => {
          // TODO: I'm not sure why processError's equivalent
          // here is not async.
          actualHandlers.processError(error, context);
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
  