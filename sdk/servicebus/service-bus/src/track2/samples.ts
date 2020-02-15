import { QueueReceiverClientImpl } from "./queueReceiverClientImpl";
import { SettleableContext, Message, PlainContext, SessionMessage, SessionContext } from "./models";
import { QueueSessionReceiverClientImpl } from './queueSessionReceiverClientImpl';
import { SessionConnectionCache } from './connectionCache';

// Interesting stuff:
// * We use a special Context (`SettleableContext`) when they peek
//   lock that allows them to settle messages. We do NOT pass this
//   context when they do a ReceiveAndDelete since that wouldn't
//   make sense.
export async function demoPeekLock(): Promise<void> {
  const consumerClient = new QueueReceiverClientImpl("connection string", "queue name", {});

  const consumer = consumerClient.streamMessagesToHandler("PeekLock", {
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
  const consumerClient = new QueueReceiverClientImpl("connection string", "queue name", {});

  consumerClient.streamMessagesToHandler("ReceiveAndDelete", {
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
  const cache = new SessionConnectionCache();
  const consumerClient = new QueueSessionReceiverClientImpl("connection string", "queue name", {
    session: {
      id: "session-id-g0es-here",
      cache
    }
  });

  consumerClient.streamMessagesToHandler("PeekLock", {
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
