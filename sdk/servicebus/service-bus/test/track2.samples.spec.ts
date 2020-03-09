// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ReceivedMessage, ContextWithSettlement } from "../src/models";
import { delay, SendableMessageInfo } from "../src";
import { TestClientType } from "./utils/testUtils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  createConnectionContext,
  getEntityNameFromConnectionString
} from "../src/constructorHelpers";
import { createServiceBusClientForTests, ServiceBusClientForTests } from "./utils/testutils2";
import { Sender } from "../src/sender";
chai.use(chaiAsPromised);
const assert = chai.assert;

describe("Sample scenarios for track 2", () => {
  let serviceBusClient: ServiceBusClientForTests;

  before(async () => {
    serviceBusClient = createServiceBusClientForTests();
  });

  after(() => {
    return serviceBusClient.test.after();
  });

  describe("queues (no sessions)", async () => {
    let queueName: string;
    let sender: Sender;

    before(async () => {
      const { queue } = await serviceBusClient.test.createTestEntities(
        TestClientType.UnpartitionedQueue
      );
      queueName = queue!;
    });

    beforeEach(() => {
      sender = serviceBusClient.test.addToCleanup(serviceBusClient.getSender(queueName));
    });

    afterEach(async () => {
      return serviceBusClient.test.afterEach();
    });

    it("Queue, peek/lock", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(queueName, "peekLock")
      );

      await sendSampleMessage(sender, "Queue, peek/lock");

      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(
          message: ReceivedMessage,
          context: ContextWithSettlement
        ): Promise<void> {
          await context.complete(message);
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate("Queue, peek/lock", receivedBodies, errors, receiver);
    });

    it("Queue, peek/lock, receiveBatch", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(queueName, "receiveAndDelete")
      );

      await sendSampleMessage(sender, "Queue, peek/lock, receiveBatch");

      const receivedBodies: string[] = [];

      for (const message of (await receiver.receiveBatch(1, 5)).messages) {
        receivedBodies.push(message.body);
      }

      // TODO: this isn't the greatest re-use...
      await waitAndValidate("Queue, peek/lock, receiveBatch", receivedBodies, [], receiver);
    });

    it("Queue, peek/lock, iterate messages", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(queueName, "peekLock")
      );

      await sendSampleMessage(sender, "Queue, peek/lock, iterate messages");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      // TODO: error handling? Does the iterate just terminate?
      for await (const { message, context } of receiver.getMessageIterator()) {
        if (message == null) {
          // user has the option of handling "no messages arrived by the maximum wait time"
          console.log(`No message arrived within our max wait time`);
          continue;
        }

        try {
          await context.complete(message);
          receivedBodies.push(message.body);
          break;
        } catch (err) {
          await context.abandon(message);
          throw err;
        }
      }

      await waitAndValidate("Queue, peek/lock, iterate messages", receivedBodies, errors, receiver);
    });

    it("Queue, receive and delete", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(queueName, "receiveAndDelete")
      );

      await sendSampleMessage(sender, "Queue, receiveAndDelete");

      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(message: ReceivedMessage): Promise<void> {
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate("Queue, receiveAndDelete", receivedBodies, errors, receiver);
    });

    it("Queue, receive and delete, iterate messages", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(queueName, "receiveAndDelete")
      );

      await sendSampleMessage(sender, "Queue, receive and delete, iterate messages");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      // TODO: error handling? Does the iterate just terminate?
      for await (const { message, context } of receiver.getMessageIterator()) {
        assert.notOk((context as any).complete);

        if (message == null) {
          // user has the option of handling "no messages arrived by the maximum wait time"
          console.log(`No message arrived within our max wait time`);
          continue;
        }

        try {
          receivedBodies.push(message.body);
          break;
        } catch (err) {
          throw err;
        }
      }

      await waitAndValidate(
        "Queue, receive and delete, iterate messages",
        receivedBodies,
        errors,
        receiver
      );
    });
  });

  describe("subscriptions (no sessions)", () => {
    let sender: Sender;
    let topic: string;
    let subscription: string;

    before(async () => {
      const entity = await serviceBusClient.test.createTestEntities(
        TestClientType.UnpartitionedSubscription
      );

      topic = entity.topic!;
      subscription = entity.subscription!;
    });

    beforeEach(() => {
      sender = serviceBusClient.test.addToCleanup(serviceBusClient.getSender(topic));
    });

    afterEach(async () => {
      return serviceBusClient.test.afterEach();
    });

    it("Subscription, peek/lock", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(topic, subscription, "peekLock")
      );

      await sendSampleMessage(sender, "Subscription, peek/lock");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(
          message: ReceivedMessage,
          context: ContextWithSettlement
        ): Promise<void> {
          await context.complete(message);
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate("Subscription, peek/lock", receivedBodies, errors, receiver);
    });

    it("Subscription, receive and delete", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(topic, subscription, "receiveAndDelete")
      );

      await sendSampleMessage(sender, "Subscription, receive and delete");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(message: ReceivedMessage): Promise<void> {
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate("Subscription, receive and delete", receivedBodies, errors, receiver);
    });

    it("Subscription, peek/lock, iterate messages", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(topic, subscription, "peekLock")
      );

      await sendSampleMessage(sender, "Subscription, peek/lock, iterate messages");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      // TODO: error handling? Does the iterate just terminate?
      for await (const { message, context } of receiver.getMessageIterator()) {
        if (message == null) {
          // user has the option of handling "no messages arrived by the maximum wait time"
          console.log(`No message arrived within our max wait time`);
          continue;
        }

        try {
          await context.complete(message);
          receivedBodies.push(message.body);
          break;
        } catch (err) {
          await context.abandon(message);
          throw err;
        }
      }

      await waitAndValidate(
        "Subscription, peek/lock, iterate messages",
        receivedBodies,
        errors,
        receiver
      );
    });

    it("Subscription, receive and delete, iterate messages", async () => {
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getReceiver(topic, subscription, "receiveAndDelete")
      );

      await sendSampleMessage(sender, "Subscription, receive and delete, iterate messages");

      // etc...
      // receiverClient.getRules();
      const errors: string[] = [];
      const receivedBodies: string[] = [];

      // TODO: error handling? Does the iterate just terminate?
      for await (const { message, context } of receiver.getMessageIterator()) {
        assert.notOk((context as any).complete);

        if (message == null) {
          // user has the option of handling "no messages arrived by the maximum wait time"
          console.log(`No message arrived within our max wait time`);
          continue;
        }

        try {
          receivedBodies.push(message.body);
          break;
        } catch (err) {
          throw err;
        }
      }

      await waitAndValidate(
        "Subscription, receive and delete, iterate messages",
        receivedBodies,
        errors,
        receiver
      );
    });
  });

  describe("queues (with sessions)", () => {
    let sender: Sender;
    let queue: string;

    before(async () => {
      const entities = await serviceBusClient.test.createTestEntities(
        TestClientType.UnpartitionedQueueWithSessions
      );
      queue = entities.queue!;
      sender = serviceBusClient.test.addToCleanup(serviceBusClient.getSender(queue));
    });

    it("Queue, receive and delete, sessions", async () => {
      const sessionId = Date.now().toString();
      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getSessionReceiver(queue, "receiveAndDelete", sessionId)
      );

      sendSampleMessage(sender, "Queue, receive and delete, sessions", sessionId);

      // note that this method is now available - only shows up in auto-complete
      // if you construct this object with a session.
      await receiver.renewSessionLock();

      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(message: ReceivedMessage): Promise<void> {
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate(
        "Queue, receive and delete, sessions",
        receivedBodies,
        errors,
        receiver
      );
    });

    it("Queue, peek/lock, sessions", async () => {
      const sessionId = Date.now().toString();

      const receiver = serviceBusClient.test.addToCleanup(
        serviceBusClient.getSessionReceiver(queue, "peekLock", sessionId)
      );

      sendSampleMessage(sender, "Queue, peek/lock, sessions", sessionId);

      // note that this method is now available - only shows up in auto-complete
      // if you construct this object with a session.
      await receiver.renewSessionLock();

      const errors: string[] = [];
      const receivedBodies: string[] = [];

      receiver.subscribe({
        async processMessage(message: ReceivedMessage): Promise<void> {
          receivedBodies.push(message.body);
        },
        async processError(err: Error): Promise<void> {
          errors.push(err.message);
        }
      });

      await waitAndValidate("Queue, peek/lock, sessions", receivedBodies, errors, receiver);
    });
  });

  async function sendSampleMessage(senderClient: Sender, body: string, sessionId?: string) {
    const message: SendableMessageInfo = {
      body
    };

    if (sessionId) {
      message.sessionId = sessionId;
    }

    await senderClient.send(message);
  }
});

describe("ConstructorHelpers for track 2", () => {
  const entityConnectionString =
    "Endpoint=sb://host/;SharedAccessKeyName=queueall;SharedAccessKey=thesharedkey=;EntityPath=myentity";

  const serviceBusConnectionString =
    "Endpoint=sb://host/;SharedAccessKeyName=queueall;SharedAccessKey=thesharedkey=";

  const fakeTokenCredential = {
    getToken: async () => null,
    sentinel: "test token credential"
  };

  const badAuths = [
    // missing required fields
    { connectionString: serviceBusConnectionString },
    { topicConnectionString: entityConnectionString },
    { tokenCredential: fakeTokenCredential } as any,

    // wrong types
    { connectionString: 4, topicName: "myentity", subscriptionName: "mysubscription" },
    {
      connectionString: serviceBusConnectionString,
      topicName: 4,
      subscriptionName: "mysubscription"
    },
    { connectionString: serviceBusConnectionString, topicName: "myentity", subscriptionName: 4 },
    { connectionString: "", topicName: "myentity", subscriptionName: "mysubscription" },
    {
      connectionString: serviceBusConnectionString,
      topicName: "",
      subscriptionName: "mysubscription"
    },
    { connectionString: serviceBusConnectionString, topicName: "myentity", subscriptionName: "" },
    { connectionString: 4, queueName: "myentity" },
    { connectionString: serviceBusConnectionString, queueName: 4 },
    { queueConnectionString: 4 },
    { queueConnectionString: "" },
    { topicConnectionString: 4, subscriptionName: "mysubscription" },
    { topicConnectionString: entityConnectionString, subscriptionName: 4 },
    { topicConnectionString: "", subscriptionName: "mysubscription" },
    { topicConnectionString: entityConnectionString, subscriptionName: "" },

    // no entity name present for entity connection string types
    {
      topicConnectionString:
        "Endpoint=sb://host/;SharedAccessKeyName=queueall;SharedAccessKey=thesharedkey=",
      subscriptionName: "mysubscription"
    },
    {
      queueConnectionString:
        "Endpoint=sb://host/;SharedAccessKeyName=queueall;SharedAccessKey=thesharedkey="
    }
  ];

  badAuths.forEach((badAuth) => {
    it(`createConnectionContext - bad auth ${JSON.stringify(badAuth)}`, () => {
      assert.throws(() => {
        createConnectionContext(badAuth, {});
      });
    });
  });

  it("getEntityNameFromConnectionString", () => {
    assert.equal("myentity", getEntityNameFromConnectionString(entityConnectionString));
    assert.throws(() => getEntityNameFromConnectionString(serviceBusConnectionString));
  });
});

interface Diagnostics {
  peek(maxMessageCount?: number): Promise<ReceivedMessage[]>;
  peekBySequenceNumber(
    fromSequenceNumber: Long,
    maxMessageCount?: number
  ): Promise<ReceivedMessage[]>;
}

async function waitAndValidate(
  expectedMessage: string,
  receivedBodies: string[],
  errors: string[],
  receiverClient: { diagnostics: Diagnostics }
) {
  const maxChecks = 20;
  let numChecks = 0;

  while (receivedBodies.length === 0 && errors.length === 0) {
    if (++numChecks >= maxChecks) {
      throw new Error("Messages/errors never arrived.");
    }
    await delay(500);
  }

  const remainingMessages = (await receiverClient.diagnostics.peek(1)).map((m) => m.body);
  assert.isEmpty(errors);
  assert.isEmpty(remainingMessages);
  assert.deepEqual([expectedMessage], receivedBodies);
}
