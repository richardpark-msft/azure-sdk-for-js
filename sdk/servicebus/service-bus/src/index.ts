// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/// <reference lib="es2015" />
/// <reference lib="esnext.asynciterable" />

export { ServiceBusClient, ServiceBusClientOptions } from "./serviceBusClient";
export {
  TokenType,
  TokenCredential,
  DataTransformer,
  delay,
  MessagingError
} from "@azure/core-amqp";

export { QueueClient } from "./queueClient";
export { TopicClient } from "./topicClient";
export { SubscriptionClient } from "./subscriptionClient";

export { Sender } from "./sender";
export { Receiver, SessionReceiver } from "./receiver";

export { MessageHandlerOptions } from "./core/streamingReceiver";
export { OnError, OnMessage } from "./core/messageReceiver";
export { SessionReceiverOptions, SessionMessageHandlerOptions } from "./session/messageSession";

export { CorrelationFilter, RuleDescription } from "./core/managementClient";

export {
  ServiceBusMessage,
  ReceivedMessageInfo,
  SendableMessageInfo,
  DeadLetterOptions,
  ReceiveMode
} from "./serviceBusMessage";
export { Delivery, WebSocketImpl } from "rhea-promise";

import { QueueReceiverClient as Track2QueueConsumerClient } from "./track2/queueReceiverClient";
import { QueueSenderClient as Track2QueueProducerClient } from "./track2/queueSenderClient";

import {
  Message as Track2Message,
  SendableMessage as Track2SendableMessage,
  PeekedMessage as Track2PeekedMessage,
  SessionMessage as Track2SessionMessage,
  MessageBatch as Track2MessageBatch,
  ReceiverHandlers as Track2ReceiverHandlers,
  Closeable as Track2Closeable,
  SessionContext as Track2SessionContext,
  PlainContext as Track2PlainContext,
  SettleableContext as Track2SettleableContext,
  QueueReceiverClientOptions as Track2QueueReceiverClientOptions,
  QueueSenderClientOptions as Track2QueueSenderClientOptions,
  SubscriptionReceiverClientOptions as Track2SubscriptionReceiverClientOptions,
  TopicSenderClientOptions as Track2TopicSenderClientOptions,
  CloseableAsyncIterator as Track2CloseableAsyncIterator,
  FetchResult as Track2FetchResult,
  FetchOptions as Track2FetchOptions
} from "./track2/models";

export {
  Track2QueueConsumerClient,
  Track2QueueProducerClient,
  Track2Message,
  Track2SendableMessage,
  Track2PeekedMessage,
  Track2SessionMessage,
  Track2MessageBatch,
  Track2ReceiverHandlers,
  Track2Closeable,
  Track2SubscriptionReceiverClientOptions,
  Track2SessionContext,
  Track2PlainContext,
  Track2SettleableContext,
  Track2QueueReceiverClientOptions,
  Track2QueueSenderClientOptions,
  Track2TopicSenderClientOptions,
  Track2CloseableAsyncIterator,
  Track2FetchResult,
  Track2FetchOptions
};
