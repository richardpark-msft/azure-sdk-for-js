import { QueueConsumerClient } from "../src/track2/queueConsumerClient";
import {
  PlainContext,
  Message,
  SettleableContext,
  CloseableThingThatNeedsABetterNameThatIsKindOfLikeAnActiveSubscriptionButToTopicsOrQueues,
  PeekedMessage
} from "../src/track2/models";
import { QueueProducerClient } from "../src/track2/queueProducerClient";
import Long from "long";

/*
1. Receive messages via handler (push)
  * Show where receive mode is
  * Show how the clients are constructed
  * Sessions
2. Receive messages by pulling messages (pull)
  * Does it batch? Does it return single messages?
3. Send messages
4. .peek()? How does it work in your library?
5. Does your library support autocommit
  * Where do you do settling?
6. Scheduling/cancel scheduling a message? 
7. Receiving and settling of deferred messages 
8. Renewing message lock 
9. Renewing session lock 
10. Set and get session state
Additional:
* Does your library support connection sharing?
* Any features you have that you think are not in other languages?
*/

export async function sample1ReceiveMessagesViaHandlerNoSessions() {
  const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
    "connection-string",
    "queue-name"
  );

  // receiveMode passed as part of the `consume` call
  const closeableThing: CloseableThingThatNeedsABetterNameThatIsKindOfLikeAnActiveSubscriptionButToTopicsOrQueues = await queueConsumerClient.consume(
    "PeekLock",
    {
      async processMessage(message: Message, settlableContext: SettleableContext) {
        // common fields
        // message.body;

        // settling: done via a context object passed into the user's callback
        settlableContext.complete(message);
        settlableContext.abandon(message);
      },
      async processError(err: Error, context: PlainContext) {}
    }
  );

  await closeableThing.close();
}

export async function sample1ReceiveMessagesViaHandlerWithSessions() {
  const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
    "connection-string",
    "queue-name"
  );

  // receiveMode passed as part of the `consume` call
  const closeableThing: CloseableThingThatNeedsABetterNameThatIsKindOfLikeAnActiveSubscriptionButToTopicsOrQueues = await queueConsumerClient.consume(
    "session-id-goes-here",
    "PeekLock",
    {
      async processMessage(message: Message, settlableContext: SettleableContext) {
        // common fields
        // message.body;

        // settling: done via a context object passed into the user's callback
        // NOTE: in "ReceiveAndDelete" mode these methods are not in the context at all (compile-time error)
        settlableContext.complete(message);
        settlableContext.abandon(message);
      },
      async processError(err: Error, context: PlainContext) {}
    }
  );

  await closeableThing.close();
}

export async function sample2ReceiveMessagesViaPull() {
  // no pull in JS for now although I was thinking of an iterator based version.
}

export async function sample3SendMessages() {
  const queueProducerClient: QueueProducerClient = new QueueProducerClient(
    "connection-string",
    "queue-name"
  );

  // without session
  queueProducerClient.send({
    body: "body"
  });

  // with session
  queueProducerClient.send({
    body: "body",
    sessionId: "session-id-goes-here"
  });

  await queueProducerClient.close();
}

export async function sample4PeekNoSessions() {
  // Peeking both with a session ID and without.
  const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
    "connection-string",
    "queue-name"
  );

  // of type: PeekedMessage[]
  peekedMessages = await queueConsumerClient.peekWithoutLock(maxMessageCount);

  // or with a session:
  // of type: PeekedMessage[]
  peekedMessages = await queueConsumerClient.peekWithoutLock(
    "session-id-goes-here",
    maxMessageCount
  );

  // common fields:
  // peekedMessages[0].body
}

// just for the samples, don't care about the values.
export const maxMessageCount = 1; // default
export const sequenceNumber = new Long(0);
export let peekedMessages: PeekedMessage[];
