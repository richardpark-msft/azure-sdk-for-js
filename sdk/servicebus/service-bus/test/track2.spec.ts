import chai from "chai";
import * as dotenv from "dotenv";
import { getUniqueName } from "../src/util/utils";
import {
  TestClients,
  createTestClients,
  createHandlerThatCompletesEveryMessage,
  loopUntil,
  createReceiveAndDeleteHandler
} from "./track2/track2helpers";
import { delay } from "../src";
const should = chai.should();

dotenv.config();

describe.only("queue", () => {
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

      const testHandler = createHandlerThatCompletesEveryMessage();
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

      const testHandler = createHandlerThatCompletesEveryMessage();
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

    it("scheduling via scheduleMessage()", async () => {
      const futureIncrementInMs = 10;
      let scheduledDate = Date.now() + futureIncrementInMs;

      const scheduledMessageId = await testClients.producer.scheduleMessage(
        new Date(scheduledDate),
        {
          body: "hello world!"
        }
      );

      scheduledMessageId.toNumber().should.be.greaterThan(0);

      await delay(futureIncrementInMs);

      let fetchResult = await testClients.consumer.fetch("ReceiveAndDelete", {
        maxWaitTimeInMs: 1000
      });

      const message = await fetchResult.next();

      // TODO: this is going to be easy to forget to do.
      await fetchResult.close();

      should.exist(message && message.value && message.value.scheduledEnqueueTimeUtc);
      message!.value!.scheduledEnqueueTimeUtc!.should.equal(scheduledDate);
    });

    // TODO: which of these is more intuitive? Using a method or setting a property on the message?
    it("scheduling via the .scheduleEnqueueTimeUtc property", async () => {
      const futureIncrementInMs = 10;
      let scheduledDate = Date.now() + futureIncrementInMs;

      // or you can just set the time on the message you send and use the normal path
      scheduledDate = Date.now() + 10;

      await testClients.producer.send({
        body: "this message is _also_ scheduled",
        scheduledEnqueueTimeUtc: new Date(scheduledDate)
      });

      await delay(futureIncrementInMs);

      const fetchResult = await testClients.consumer.fetch("ReceiveAndDelete", {
        maxWaitTimeInMs: 1000
      });

      const message = await fetchResult.next();
      await fetchResult.close();

      should.exist(message && message.value && message.value.scheduledEnqueueTimeUtc);
      message!.value!.scheduledEnqueueTimeUtc!.should.equal(scheduledDate);
    });
  });
});
