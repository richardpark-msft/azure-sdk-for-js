// import { ServiceBusClient } from "../serviceBusClient";
// import { ReceiveMode, ServiceBusMessage, ReceivedMessageInfo } from "../serviceBusMessage";
// import { QueueClient } from "../queueClient";
// import { Receiver, SessionReceiver } from "../receiver";
// import Long from "long";

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
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   // receiveMode done as part of the `createReceiver` call.
//   const receiver: Receiver = queueClient.createReceiver(ReceiveMode.peekLock);

//   receiver.registerMessageHandler(
//     // onMessage
//     async (event: ServiceBusMessage) => {
//       // some common fields:
//       //
//       // event.body
//       // event.sessionId    // always here, but probably not filled in when not doing sessions

//       // settling: completion done on the _message_ itself
//       event.complete();
//     },
//     // onError
//     (err: Error) => {
//       // errors here
//     }
//   );

//   // wait or delay and then close the receiver to stop
//   await receiver.close();
// }

// async function sample1ReceiveMessagesViaHandlerWithSessions() {
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   // session ID is passed as part of creating the receiver
//   //
//   // `SessionReceiver` and `Receiver` do NOT share a base class/interface but they have
//   // a similar shape.
//   const receiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
//     sessionId: "session-id-goes-here"
//   });

//   receiver.registerMessageHandler(
//     // onMessage
//     async (event: ServiceBusMessage) => {
//       // some common fields:
//       //
//       // event.body
//       // event.sessionId

//       // completion done on the _message_ itself
//       event.complete();
//     },
//     // onError
//     (err: Error) => {
//       // errors here
//     }
//   );

//   // wait or delay and then close the receiver to stop
//   await receiver.close();
// }

// async function sample2ReceiveMessagesViaPullNoSessions() {
//   // no pull in JS
// }
// async function sample2ReceiveMessagesViaPullWithSessions() {
//   // no pull in JS
// }

// async function sample3SendMessages() {
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   const sender = queueClient.createSender();

//   await sender.send({
//     body: "message body" // typed as 'any'.
//   });

//   // we also have "batching" via sending an array of
//   // messages
//   await sender.sendBatch([
//     {
//       body: "message body"
//     }
//   ]);
// }
// async function sample3SendMessagesWithSession() {
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   const sender = queueClient.createSender();

//   await sender.send({
//     body: "message body", // typed as 'any'.
//     sessionId: "session-id-goes-here"
//   });

//   // we also have "batching" via sending an array of
//   // messages
//   await sender.sendBatch([
//     {
//       body: "message body",
//       // TODO: I haven't tried this if you used multiple sessions
//       sessionId: "session-id-goes-here"
//     }
//   ]);
// }

// async function sample4PeekNoSessions() {
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   const peeked1: ReceivedMessageInfo[] = await queueClient.peek(maxMessageCount);
//   const peeked2: ReceivedMessageInfo[] = await queueClient.peekBySequenceNumber(
//     sequenceNumber,
//     maxMessageCount
//   );
// }

// async function sample4PeekWithSessions() {
//   const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
//     "connection-string"
//   );
//   const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

//   const receiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
//     sessionId: "session-id-goes-here"
//   });

//   const peeked1: ReceivedMessageInfo[] = await receiver.peek(maxMessageCount);
//   const peeked2: ReceivedMessageInfo[] = await receiver.peekBySequenceNumber(sequenceNumber);
// }

// // just for the samples, don't care about the values.
// const maxMessageCount = 1; // default
// const sequenceNumber = new Long(0);
