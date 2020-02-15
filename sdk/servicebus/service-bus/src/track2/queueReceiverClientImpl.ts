import { ServiceBusClient } from '../serviceBusClient';
import { QueueClient, ReceiveMode, Receiver, ServiceBusMessage, MessagingError } from '..';
import { QueueReceiverClientOptions, FetchOptions, FetchResult, Message, PlainContext, SettleableContext, ReceiverHandlers, Closeable, PeekedMessage } from './models';
import { peekBySequenceNumber, peek } from './utils/peekHelpers';

export class QueueReceiverClientImpl {
    private _sbClient: ServiceBusClient;
    private _queueClient: QueueClient;
    constructor(queueConnectionString: string, options?: QueueReceiverClientOptions);
    constructor(
      serviceBusConnectionString: string,
      queueName: string,
      options?: QueueReceiverClientOptions
    );
    constructor(
      queueOrServiceBusConnectionString1: string,
      queueNameOrOptions2?: string | QueueReceiverClientOptions,
      options3?: QueueReceiverClientOptions
    ) {
      if (typeof queueNameOrOptions2 === "string") {
        const serviceBusConnectionString = queueOrServiceBusConnectionString1;
        const queueName = queueNameOrOptions2;
        const options: undefined | QueueReceiverClientOptions = options3;
  
        this._sbClient = new ServiceBusClient(serviceBusConnectionString, options);
        this._queueClient = this._sbClient.createQueueClient(queueName);
      } else {
        const queueConnectionString = queueOrServiceBusConnectionString1;
        const options: undefined | QueueReceiverClientOptions = queueNameOrOptions2;
  
        // snag the entity name from the connection string
        const entityPathMatch = queueConnectionString.match(/^.+EntityPath=(.+?);{0,1}$/);
  
        if (entityPathMatch!.length !== 2) {
          throw new Error("Invalid queue connection string - no EntityPath");
        }
  
        this._sbClient = new ServiceBusClient(queueConnectionString, options);
        this._queueClient = this._sbClient.createQueueClient(entityPathMatch![1]);
      }
    }
  
    createMessageIterator(
      mode: "ReceiveAndDelete",
      options?: FetchOptions
    ): FetchResult<Message | undefined, PlainContext>;
    createMessageIterator(
      mode: "PeekLock",
      options?: FetchOptions
    ): FetchResult<Message | undefined, SettleableContext>;
    createMessageIterator(
      mode: "PeekLock" | "ReceiveAndDelete",
      options?: FetchOptions
    ):
      | FetchResult<Message | undefined, SettleableContext>
      | FetchResult<Message | undefined, PlainContext> {
      if (options == null) {
        options = {};
      }
  
      const receiveMode = mode === "PeekLock" ? ReceiveMode.peekLock : ReceiveMode.receiveAndDelete;
      let receiver = this._queueClient.createReceiver(receiveMode);
  
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
      mode1: "PeekLock" | "ReceiveAndDelete" | string,
      handlers2:
        | ReceiverHandlers<Message, SettleableContext & PlainContext>
        | ReceiverHandlers<Message, PlainContext>,
    ): Closeable {
        let receiver: Receiver;
        if (mode1 === "PeekLock") {
          receiver = this._createPeekLockReceiver(handlers2);
        } else if (mode1 === "ReceiveAndDelete") {
          receiver = this._createReceiveAndDeleteReceiver(handlers2);
        } else {
          throw new Error("Unhandled argument combination");
        }
        return <Closeable>{
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
  