import { ServiceBusMessage, ReceivedMessageInfo, SendableMessageInfo } from "../serviceBusMessage";
import { ServiceBusClientOptions } from "../serviceBusClient";

// message with a body and any basic fields that exist in all message types
// basically a `ServiceBusMessage` w/o the "settlement" methods
export interface Message
  extends Omit<ServiceBusMessage, "abandon" | "complete" | "defer" | "deadLetter"> {}

export interface SendableMessage extends SendableMessageInfo {}

export interface PeekedMessage extends ReceivedMessageInfo {}

export interface SessionMessage extends Message {
  sessionId: string;
}

export interface MessageBatch {
  // TODO: can we do better here this time around?
  tryAdd(message: Message): boolean;
}

export interface ReceiverHandlers<MessageType, ContextType> {
  processEvents(messages: MessageType[], context: ContextType): Promise<void>;
  // TODO: needs to be async underneath.
  processError(err: Error, context: PlainContext): Promise<void>;
}

export interface CloseableThing {
  close(): Promise<void>;
}

export interface SessionContext {
  sessionId: string;
  renewSessionLock(): Promise<void>;
}

export interface PlainContext {}

export interface SettleableContext {
  abandon(message: Message): Promise<void>;
  complete(message: Message): Promise<void>;
  deadLetter(message: Message): Promise<void>;
  defer(message: Message): Promise<void>;
}

export interface QueueConsumerClientOptions extends ServiceBusClientOptions {}

export interface CloseableAsyncIterator<MessageT> extends AsyncIterableIterator<MessageT> {
  close(): Promise<void>;
}

export interface FetchResult<MessageT, ContextT> extends CloseableThing {
  iterator: AsyncIterableIterator<MessageT>;
  context: ContextT;
}

export interface FetchOptions {
  maxWaitTimeInSeconds?: number;
}
