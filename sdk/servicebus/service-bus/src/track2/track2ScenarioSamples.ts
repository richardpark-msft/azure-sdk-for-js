// import { QueueConsumerClient } from "./queueConsumerClient";
// import {
//   PlainContext,
//   Message,
//   SettleableContext as SettableContext,
//   CloseableThing,
//   PeekedMessage
// } from "./models";
// import { QueueProducerClient } from "./queueProducerClient";

// /*
// 1. Receive messages via handler (push)
//   * Show where receive mode is
//   * Show how the clients are constructed
//   * Sessions
// 2. Receive messages by pulling messages (pull)
//   * Does it batch? Does it return single messages?
// 3. Send messages
// 4. .peek()? How does it work in your library?
// 5. Does your library support autocommit
//   * Where do you do settling?
// Additional:
// * Does your library support connection sharing?
// * Any features you have that you think are not in other languages?
// */

// async function sample1ReceiveMessagesViaHandlerNoSessions() {
//   const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
//     "connection-string",
//     "queue-name"
//   );

//   // receiveMode passed as part of the `consume` call
//   const closeableThing: CloseableThing = await queueConsumerClient.consume("PeekLock", {
//     async processEvents(messages: Message[], settlableContext: SettableContext) {
//       for (const message of messages) {
//         // common fields
//         // message.body;

//         // settling: done via a context object passed into the user's callback
//         settlableContext.complete(message);
//         settlableContext.abandon(message);
//       }
//     },
//     async processError(err: Error, context: PlainContext) {}
//   });

//   await closeableThing.close();
// }

// async function sample1ReceiveMessagesViaHandlerWithSessions() {
//   const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
//     "connection-string",
//     "queue-name"
//   );

//   // receiveMode passed as part of the `consume` call
//   const closeableThing: CloseableThing = await queueConsumerClient.consume(
//     "session-id-goes-here",
//     "PeekLock",
//     {
//       async processEvents(messages: Message[], settlableContext: SettableContext) {
//         for (const message of messages) {
//           // common fields
//           // message.body;

//           // settling: done via a context object passed into the user's callback
//           // NOTE: in "ReceiveAndDelete" mode these methods are not in the context at all (compile-time error)
//           settlableContext.complete(message);
//           settlableContext.abandon(message);
//         }
//       },
//       async processError(err: Error, context: PlainContext) {}
//     }
//   );

//   await closeableThing.close();
// }

// async function sample2ReceiveMessagesViaPullNoSessions() {
//   // no pull in JS for now although I was thinking of an iterator based version.
// }
// async function sample2ReceiveMessagesViaPullWithSessions() {
//   // no pull in JS for now although I was thinking of an iterator based version.
// }

// async function sample3SendMessages() {
//   const queueProducerClient: QueueProducerClient = new QueueProducerClient(
//     "connection-string",
//     "queue-name"
//   );

//   queueProducerClient.send({
//     body: "body"
//   });

//   await queueProducerClient.close();
// }

// async function sample3SendMessagesWithSession() {
//   const queueProducerClient: QueueProducerClient = new QueueProducerClient(
//     "connection-string",
//     "queue-name"
//   );

//   queueProducerClient.send({
//     body: "body",
//     sessionId: "session-id-goes-here"
//   });

//   await queueProducerClient.close();
// }

// async function sample4PeekNoSessions() {
//   const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
//     "connection-string",
//     "queue-name"
//   );

//   const peekedMessages: PeekedMessage[] = await queueConsumerClient.peekWithoutLock(
//     maxMessageCount
//   );

//   // common fields:
//   // peekedMessages[0].body
// }

// async function sample4PeekWithSessions() {
//   const queueConsumerClient: QueueConsumerClient = new QueueConsumerClient(
//     "connection-string",
//     "queue-name"
//   );

//   const peekedMessages: PeekedMessage[] = await queueConsumerClient.peekWithoutLock(
//     "session-id-goes-here",
//     maxMessageCount
//   );

//   // common fields:
//   // peekedMessages[0].body
//   // peekedMessages[0].sessionId
// }

// // just for the samples, don't care about the values.
// const maxMessageCount = 1; // default
// const sequenceNumber = new Long(0);
