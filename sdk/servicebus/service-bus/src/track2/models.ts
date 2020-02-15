import { ServiceBusMessage, ReceivedMessageInfo, SendableMessageInfo } from "../serviceBusMessage";
import { ServiceBusClientOptions } from "../serviceBusClient";
import { SessionConnectionCache } from './connectionCache';

// message with a body and any basic fields that exist in all message types
// basically a `ServiceBusMessage` w/o the "settlement" methods
export interface Message
  extends Omit<ServiceBusMessage, "abandon" | "complete" | "defer" | "deadLetter"> { }

export interface SendableMessage extends SendableMessageInfo { }

export interface PeekedMessage extends ReceivedMessageInfo { }

export interface SessionMessage extends Message {
  sessionId: string;
}

export interface MessageBatch {
  // TODO: can we do better here this time around?
  tryAdd(message: Message): boolean;
}

export interface ReceiverHandlers<MessageType, ContextType> {
  processMessage(message: MessageType, context: ContextType): Promise<void>;
  // TODO: needs to be async underneath.
  processError(err: Error, context: PlainContext): Promise<void>;
}

export interface Closeable {
  close(): Promise<void>;
}

export interface SessionContext {
  sessionId: string;
  renewSessionLock(): Promise<void>;
}

export interface PlainContext { }

export interface SettleableContext {
  abandon(message: Message): Promise<void>;
  complete(message: Message): Promise<void>;
  deadLetter(message: Message): Promise<void>;
  defer(message: Message): Promise<void>;
}

export interface QueueReceiverClientOptions extends ServiceBusClientOptions {
  
}

export interface SessionInfo {
  id: string;
  cache: SessionConnectionCache;
}

export interface QueueSessionReceiverClientOptions extends QueueReceiverClientOptions {
  session: SessionInfo;
}

export interface QueueSenderClientOptions extends ServiceBusClientOptions {
}

export interface TopicSenderClientOptions extends ServiceBusClientOptions {
}

export interface SubscriptionReceiverClientOptions extends ServiceBusClientOptions {
}

export interface CloseableAsyncIterator<MessageT> extends AsyncIterableIterator<MessageT> {
  close(): Promise<void>;
}

// TODO: storage has async iterators, they have an
// iterator that returns some extra metadata alongside
// the entity (not directly attached)
export interface FetchResult<MessageT, ContextT>
  extends AsyncIterableIterator<MessageT>,
  Closeable {
  // Make it directly iterator.
  // iterator: AsyncIterableIterator<MessageT>;
  // [Symbol.iterator]();
  context: ContextT;
}

export interface FetchOptions {
  maxWaitTimeInMs?: number;
}

export interface SenderClient {
  send(message: SendableMessage): Promise<void>;
  scheduleMessage(scheduledEnqueueTimeUtc: Date, message: SendableMessage): Promise<Long>;
  cancelScheduledMessage(sequenceNumber: Long): Promise<void>;
}
