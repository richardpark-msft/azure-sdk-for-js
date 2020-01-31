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

describe.only("queues", () => {
  describe("no sessions", () => {
    let testClients: TestClients;

    before(async () => {
      testClients = await createTestClients("nosessions");
      await drainQueue(testClients.consumer);
    });

    after(async () => {
      await testClients.close();
    });

    it("peeklock", async () => {
      await testClients.producer.send({
        body: "hello from the world of peeklock"
      });

      let peekedMessages = await testClients.consumer.peekWithoutLock(1);
      peekedMessages
        .map((m) => m.body.toString())
        .should.deep.equal(["hello from the world of peeklock"]);

      const testHandler = createPeekAndLockHandler();
      const consumer = testClients.consumer.consume("PeekLock", testHandler);

      // TODO: need ye-olde loopUntil()
      await delay(1000 * 5);
      await consumer.close();

      peekedMessages = await testClients.consumer.peekWithoutLock(1);

      peekedMessages.should.be.empty;
      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal(["hello from the world of peeklock"]);
    });

    it("receiveAndDelete", async () => {
      await testClients.producer.send({
        body: "hello from the world of receive and delete"
      });

      let peekedMessages = await testClients.consumer.peekWithoutLock(1);
      peekedMessages
        .map((m) => m.body.toString())
        .should.deep.equal(["hello from the world of receive and delete"]);

      const testHandler = createReceiveAndDeleteHandler();
      const consumer = testClients.consumer.consume("ReceiveAndDelete", testHandler);

      // TODO: need ye-olde loopUntil()
      await delay(1000 * 5);
      await consumer.close();

      peekedMessages = await testClients.consumer.peekWithoutLock(1);

      peekedMessages.should.be.empty;
      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal(["hello from the world of receive and delete"]);
    });
  });

  describe("sessions", () => {
    let testClients: TestClients;

    before(async () => {
      testClients = await createTestClients("sessions");
    });

    after(async () => {
      await testClients.close();
    });

    it("peeklock", async () => {
      const sessionId = getUniqueName("sessions-peeklock");

      await testClients.producer.send({
        body: "hello from the world of peeklock with sessions",
        sessionId
      });

      let peekedMessages = (await testClients.consumer.peekWithoutLock(sessionId)).map((m) =>
        m.body.toString()
      );

      peekedMessages.should.deep.equal(["hello from the world of peeklock with sessions"]);

      const testHandler = createPeekAndLockHandler();
      const consumer = testClients.consumer.consume(sessionId, "PeekLock", testHandler);

      await delay(1000 * 5);
      await consumer.close();

      peekedMessages = await testClients.consumer.peekWithoutLock(sessionId, 1);
      peekedMessages.should.be.empty;

      testHandler.errors.should.deep.equal([], "should be no errors");
      testHandler.messages.should.deep.equal(
        ["hello from the world of peeklock with sessions"],
        "expected all messages to arrive"
      );
    });

    it("receiveAndDelete", async () => {
      const sessionId = getUniqueName("sessions-receiveAndDelete");

      await testClients.producer.send({
        body: "hello from the world of receive and delete with sessions",
        sessionId
      });

      let peekedMessages = await testClients.consumer.peekWithoutLock(sessionId, 1);
      peekedMessages
        .map((m) => m.body.toString())
        .should.deep.equal(["hello from the world of receive and delete with sessions"]);

      const testHandler = createReceiveAndDeleteHandler();
      const consumer = testClients.consumer.consume(sessionId, "ReceiveAndDelete", testHandler);

      // TODO: need ye-olde loopUntil()
      await delay(1000 * 5);
      await consumer.close();

      peekedMessages = await testClients.consumer.peekWithoutLock(1);

      peekedMessages.should.be.empty;
      testHandler.errors.should.deep.equal([]);
      testHandler.messages.should.deep.equal([
        "hello from the world of receive and delete with sessions"
      ]);
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
    async processEvents(messages: MessageT[], context: SettleableContext) {
      for (const message of messages) {
        try {
          // TODO: body being 'any' is still unclear to me.
          allReceivedBodies.push(message.body.toString());
          await context.complete(message);
        } catch (err) {
          errors.push(err);
          await context.abandon(message);
        }
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
    async processEvents(messages: MessageT[], context: PlainContext) {
      for (const message of messages) {
        try {
          // TODO: body being 'any' is still unclear to me.
          allReceivedBodies.push(message.body.toString());
        } catch (err) {
          errors.push(err);
        }
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
    async processEvents(messages: Message[], context: SettleableContext) {
      for (const message of messages) {
        try {
          // handle message in some way...

          // ...and now complete it so nobody else
          // attemps to process it.
          await context.complete(message);
        } catch (err) {
          await context.abandon(message);
        }
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
    async processEvents(messages: Message[], context: PlainContext) {
      for (const message of messages) {
        // handle message in some way...
        //
        // NOTE that it makes no sense to complete() a message
        // in ReceiveAndDelete mode - it's already been removed from the queue.
        console.log(`Message = ${message}`);
      }
    },
    async processError(err: Error, context: PlainContext) {
      console.log(`Error was thrown : ${err}`);
    }
  });
}

export async function demoSessionUsage(): Promise<void> {
  const consumerClient = new QueueConsumerClient("connection string", "queue name", {});

  consumerClient.consume("sessionId", "PeekLock", {
    async processEvents(messages: SessionMessage[], context: SessionContext & SettleableContext) {
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

async function drainQueue(queueClient: QueueConsumerClient): Promise<void> {
  const result = queueClient.fetch("ReceiveAndDelete", { maxWaitTimeInSeconds: 1 });
  for await (let message of result.iterator) {
    if (message == null) {
      result.close();
      break;
    }
  }
}
