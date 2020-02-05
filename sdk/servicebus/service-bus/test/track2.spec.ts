import { QueueProducerClient } from "../src/track2/queueProducerClient";
import { QueueConsumerClient } from "../src/track2/queueConsumerClient";
import {
  SettleableContext,
  Message,
  PlainContext,
  SessionMessage,
  SessionContext,
  ReceiverHandlers
} from "../src/track2/models";
import { env } from "process";
import { EnvVarKeys } from "./utils/envVarUtils";
import { delay } from "../src";
import chai from "chai";
import * as dotenv from "dotenv";
import { getUniqueName } from "../src/util/utils";
chai.should();

dotenv.config();

describe("queue", () => {
  describe("sessions", () => {
    let testClientsForSession: TestClients;

    before(async () => {
      testClientsForSession = await createTestClients("sessions");
    });

    after(async () => {
      await testClientsForSession.close();
    });

    it("push, peeklock", async () => {
      const sessionId = getUniqueName("sessions-peeklock");

      await testClientsForSession.producer.send({
        body: "hello from the world of peeklock with sessions",
        sessionId
      });

      const testHandler = createPeekAndLockHandler();
      const consumer = testClientsForSession.consumer.consume(sessionId, "PeekLock", testHandler);

      await loopUntil({
        maxTimes: 50,
        name: "loop until messages are received",
        timeBetweenRunsMs: 200,
        until: async () => {
          const peekedMessages = await testClientsForSession.consumer.peekWithoutLock(1);
          return peekedMessages.length === 0 && testHandler.messages.length >= 1;
        }
      });

      await consumer.close();

      testHandler.errors.should.deep.equal([], "should be no errors");
      testHandler.messages.should.deep.equal(
        ["hello from the world of peeklock with sessions"],
        "expected all messages to arrive"
      );
    });

    it("push, receiveAndDelete", async () => {
      const sessionId = getUniqueName("sessions-receiveAndDelete");

      await testClientsForSession.producer.send({
        body: "hello from the world of receive and delete with sessions",
        sessionId
      });

      const testHandler = createReceiveAndDeleteHandler();
      const consumer = testClientsForSession.consumer.consume(
        sessionId,
        "ReceiveAndDelete",
        testHandler
      );

      await loopUntil({
        maxTimes: 50,
        name: "loop until messages are received",
        timeBetweenRunsMs: 200,
        until: async () => {
          const peekedMessages = await testClientsForSession.consumer.peekWithoutLock(1);
          return peekedMessages.length === 0 && testHandler.messages.length >= 1;
        }
      });

      await consumer.close();

      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal([
        "hello from the world of receive and delete with sessions"
      ]);
    });

    it("pull", async () => {
      const sessionId = getUniqueName("sessions-peeklock");

      await testClientsForSession.producer.send({
        body: "queues, pull, sessions",
        sessionId
      });

      const closeableIterator = testClientsForSession.consumer.fetch(
        sessionId,
        "ReceiveAndDelete",
        {
          maxWaitTimeInMs: 100
        }
      );

      let receivedMessage = "";

      for await (let message of closeableIterator) {
        if (message != null) {
          receivedMessage = message.body;
        }

        break;
      }

      await closeableIterator.close();
      receivedMessage.should.equal("queues, pull, sessions");
    });
  });
  describe("without sessions", () => {
    let testClients: TestClients;

    before(async () => {
      testClients = await createTestClients("nosessions");
    });

    beforeEach(async () => {
      // TODO: for some reason drain is HORRENDOUSLY slow
      // await drainQueue(testClients.consumer);
    });

    after(async () => {
      await testClients.close();
    });

    it("push, peeklock", async () => {
      await testClients.producer.send({
        body: "hello from the world of peeklock"
      });

      const testHandler = createPeekAndLockHandler();
      const consumer = testClients.consumer.consume("PeekLock", testHandler);

      await loopUntil({
        maxTimes: 50,
        name: "loop until messages are received",
        timeBetweenRunsMs: 200,
        until: async () => {
          const peekedMessages = await testClients.consumer.peekWithoutLock(1);
          return peekedMessages.length === 0 && testHandler.messages.length >= 1;
        }
      });

      await consumer.close();

      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal(["hello from the world of peeklock"]);
    });

    it("push, receiveAndDelete", async () => {
      await testClients.producer.send({
        body: "hello from the world of receive and delete"
      });

      const testHandler = createReceiveAndDeleteHandler();
      const consumer = testClients.consumer.consume("ReceiveAndDelete", testHandler);

      await loopUntil({
        maxTimes: 50,
        name: "loop until messages are received",
        timeBetweenRunsMs: 200,
        until: async () => {
          const peekedMessages = await testClients.consumer.peekWithoutLock(1);
          return peekedMessages.length === 0 && testHandler.messages.length >= 1;
        }
      });

      await consumer.close();

      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal(["hello from the world of receive and delete"]);
    });

    it.skip("pull, no messages", async function() {
      const closeableIterator = testClients.consumer.fetch("ReceiveAndDelete", {
        maxWaitTimeInMs: 100
      });

      let gotNullMessage = false;

      for await (const message of closeableIterator) {
        if (message === null) {
          // when there are no messages in the queue
          // the iterator will return an undefined message
          // when the pump runs.
          gotNullMessage = true;
        }

        break;
      }

      await closeableIterator.close();
      gotNullMessage.should.be.true;

      // this test is HORRIBLY slow - our iterator takes forever to realize there's
      // no message and just return.
    });

    it("pull", async () => {
      await testClients.producer.send({
        body: "queues, pull, no sessions"
      });

      const closeableIterator = testClients.consumer.fetch("ReceiveAndDelete", {
        maxWaitTimeInMs: 100
      });

      let receivedMessage = "";

      for await (let message of closeableIterator) {
        if (message != null) {
          receivedMessage = message.body;
        }

        break;
      }

      await closeableIterator.close();
      receivedMessage.should.equal("queues, pull, no sessions");
    });
  });
});

interface RecordedData {
  messages: string[];
  errors: Error[];
}

function createPeekAndLockHandler<MessageT extends Message>(): ReceiverHandlers<
  MessageT,
  SettleableContext
> &
  RecordedData {
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

function createReceiveAndDeleteHandler<MessageT extends Message>(): ReceiverHandlers<
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

interface TestClients {
  consumer: QueueConsumerClient;
  producer: QueueProducerClient;
  close(): Promise<void>;
}

async function createTestClients(mode: "sessions" | "nosessions"): Promise<TestClients> {
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
