import {
  Message,
  ReceiverHandlers,
  SettleableContext,
  PlainContext,
  SessionMessage,
  SessionContext
} from "../../src/track2/models";

import { QueueConsumerClient } from "../../src/track2/queueConsumerClient";

import { env } from "process";

import { EnvVarKeys } from "../utils/envVarUtils";

import { QueueProducerClient } from "../../src/track2/queueProducerClient";

import { delay } from "../../src";

/**
 * @internal
 * @ignore
 */
export interface RecordedData {
  messages: string[];
  errors: Error[];
}

/**
 * @internal
 * @ignore
 */
export function createHandlerThatCompletesEveryMessage<
  MessageT extends Message
>(): ReceiverHandlers<MessageT, SettleableContext> & RecordedData {
  const errors: Error[] = [];
  const allReceivedBodies: string[] = [];

  return {
    async processMessage(message: MessageT, context: SettleableContext) {
      try {
        // TODO: body being 'any' is still unclear to me.
        allReceivedBodies.push(message.body.toString());
        await context.complete(message);
      } catch (err) {
        errors.push(err);
        await context.abandon(message);
      }
    },
    async processError(err: Error, context: PlainContext) {
      errors.push(err);
    },
    errors,
    messages: allReceivedBodies
  };
}

export function createReceiveAndDeleteHandler<MessageT extends Message>(): ReceiverHandlers<
  MessageT,
  PlainContext
> &
  RecordedData {
  const errors: Error[] = [];
  const allReceivedBodies: string[] = [];

  return {
    async processMessage(message: MessageT, context: PlainContext) {
      try {
        // TODO: body being 'any' is still unclear to me.
        allReceivedBodies.push(message.body.toString());
      } catch (err) {
        errors.push(err);
      }
    },
    async processError(err: Error, context: PlainContext) {
      errors.push(err);
    },
    errors,
    messages: allReceivedBodies
  };
}

// Interesting stuff:
// * We use a special Context (`SettleableContext`) when they peek
//   lock that allows them to settle messages. We do NOT pass this
//   context when they do a ReceiveAndDelete since that wouldn't
//   make sense.
export async function demoPeekLock(): Promise<void> {
  const consumerClient = new QueueConsumerClient(
    env[EnvVarKeys.SERVICEBUS_CONNECTION_STRING]!,
    env[EnvVarKeys.QUEUE_NAME_NO_PARTITION_SESSION]!,
    {}
  );

  const consumer = consumerClient.consume("PeekLock", {
    async processMessage(message: Message, context: SettleableContext) {
      try {
        // handle message in some way...

        // ...and now complete it so nobody else
        // attemps to process it.
        await context.complete(message);
      } catch (err) {
        await context.abandon(message);
      }
    },
    async processError(err: Error, context: SettleableContext) {
      console.log(`Error was thrown : ${err}`);
    }
  });

  await consumer.close();
}

export async function demoReceiveAndDelete(): Promise<void> {
  const consumerClient = new QueueConsumerClient("connection string", "queue name", {});

  consumerClient.consume("ReceiveAndDelete", {
    async processMessage(message: Message, context: PlainContext) {
      // handle message in some way...
      //
      // NOTE that it makes no sense to complete() a message
      // in ReceiveAndDelete mode - it's already been removed from the queue.
      console.log(`Message = ${message}`);
    },
    async processError(err: Error, context: PlainContext) {
      console.log(`Error was thrown : ${err}`);
    }
  });
}

export async function demoSessionUsage(): Promise<void> {
  const consumerClient = new QueueConsumerClient("connection string", "queue name", {});

  consumerClient.consume("sessionId", "PeekLock", {
    async processMessage(message: SessionMessage, context: SessionContext & SettleableContext) {
      // TODO: there are more methods, but this is an example of one
      // you'd expect to use when handling messages in a session.

      // TODO: another idea - have a ShutdownReason thing like we do in
      // EventHubs to indicate session expiration Or make it specific to the session
      // event handler.
      await context.renewSessionLock();
    },
    async processError(err: Error, context: PlainContext) {
      console.log(`Error was thrown : ${err}`);
    }
  });
}

export interface TestClients {
  consumer: QueueConsumerClient;
  producer: QueueProducerClient;
  close(): Promise<void>;
}

export async function createTestClients(mode: "sessions" | "nosessions"): Promise<TestClients> {
  const queueName =
    mode === "nosessions" ? env[EnvVarKeys.QUEUE_NAME]! : env[EnvVarKeys.QUEUE_NAME_SESSION]!;
  const consumer = new QueueConsumerClient(
    env[EnvVarKeys.SERVICEBUS_CONNECTION_STRING]!,
    queueName
  );
  const producer = new QueueProducerClient(
    env[EnvVarKeys.SERVICEBUS_CONNECTION_STRING]!,
    queueName
  );

  return {
    consumer,
    producer,
    async close() {
      await consumer.close();
      await producer.close();
    }
  };
}

export async function drainQueue(queueClient: QueueConsumerClient): Promise<void> {
  const result = queueClient.fetch("ReceiveAndDelete", { maxWaitTimeInMs: 100 });

  for await (let message of result) {
    if (message == null) {
      break;
    }
  }

  await result.close();
}

export async function loopUntil(args: {
  name: string;
  timeBetweenRunsMs: number;
  maxTimes: number;
  until: () => Promise<boolean>;
  errorMessageFn?: () => string;
}): Promise<void> {
  for (let i = 0; i < args.maxTimes + 1; ++i) {
    const finished = await args.until();

    if (finished) {
      return;
    }

    // loggerForTest(`[${args.name}: delaying for ${args.timeBetweenRunsMs}ms]`);
    await delay(args.timeBetweenRunsMs);
  }

  throw new Error(
    `Waited way too long for ${args.name}: ${args.errorMessageFn ? args.errorMessageFn() : ""}`
  );
}
