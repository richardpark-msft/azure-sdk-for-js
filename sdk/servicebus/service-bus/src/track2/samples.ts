import * as track2 from "./clients";
import { SettleableContext, Message, PlainContext, SessionMessage, SessionContext } from "./models";

// Interesting stuff:
// * We use a special Context (`SettleableContext`) when they peek
//   lock that allows them to settle messages. We do NOT pass this
//   context when they do a ReceiveAndDelete since that wouldn't
//   make sense.
export async function demoPeekLock(): Promise<void> {
  const consumerClient = new track2.QueueConsumerClient("connection string", "queue name", {});

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
  const consumerClient = new track2.QueueConsumerClient("connection string", "queue name", {});

  consumerClient.consume("ReceiveAndDelete", {
    async processEvents(messages: Message[], context: PlainContext) {
      for (const message of messages) {
        // handle message in some way...
        //
        // NOTE that it makes no sense to complete() a message
        // in ReceiveAndDelete mode - it's already been removed from the queue.
      }
    },
    async processError(err: Error, context: PlainContext) {
      console.log(`Error was thrown : ${err}`);
    }
  });
}

export async function demoSessionUsage(): Promise<void> {
  const consumerClient = new track2.QueueConsumerClient("connection string", "queue name", {});

  consumerClient.consumeSession("sessionId", "PeekLock", {
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
