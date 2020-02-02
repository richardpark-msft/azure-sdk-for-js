import { ServiceBusClient } from "../src/serviceBusClient";
import { ReceiveMode, ServiceBusMessage, ReceivedMessageInfo } from "../src/serviceBusMessage";
import { QueueClient } from "../src/queueClient";
import { Receiver, SessionReceiver } from "../src/receiver";
import Long from "long";
import { Sender } from "../src/sender";

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

export async function sample1ReceiveMessagesViaHandler() {
  // ## 1. Receive: "push" messages via handler
  //    * With sessions: `SessionReceiver`
  //    * Without sessions: `Receiver`
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  // receiveMode done as part of the `createReceiver` call.
  const receiver: Receiver = queueClient.createReceiver(ReceiveMode.peekLock);

  // NOTE: here's how you'd do the same receiver creation
  // but with sessions.
  //
  // `SessionReceiver` and `Receiver` do NOT share a
  // base class/interface but they have the same shape.
  // So whatever we do down below would work for either class.
  const sessionReceiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
    sessionId: "session-id-goes-here"
  });

  receiver.registerMessageHandler(
    // onMessage
    async (event: ServiceBusMessage) => {
      // some common fields:
      //
      // event.body
      // event.sessionId    // always here, but probably not filled in when not doing sessions

      // settling: completion done on the _message_ itself
      event.complete();
    },
    // onError
    (err: Error) => {
      // errors here
    }
  );

  sessionReceiver.registerMessageHandler(
    // onMessage
    async (event: ServiceBusMessage) => {
      // some common fields:
      //
      // event.body
      // event.sessionId    // always here, but probably not filled in when not doing sessions

      // settling: completion done on the _message_ itself
      event.complete();
    },
    // onError
    (err: Error) => {
      // errors here
    }
  );

  // these methods return immediately and don't return
  // anything you can use to shut down that single registered
  // message handler. You must shut down the receiver.

  await receiver.close();
  await sessionReceiver.close();
}

export async function sample2ReceiveMessagesViaPull() {
  // ## 2. Receive: pull messages. Doesn't appear to be on in track 1.
}

export async function sample3SendMessages() {
  // ## 3. Sending messages (single and batch)
  //
  //    The `sessionId` field of the message indicates if
  //    we're going to send it to a session or just to the
  //    queue itself.
  //
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  const sender = queueClient.createSender();

  await sender.send({
    body: "message body", // typed as 'any'.

    // sessionId is optional
    sessionId: "session-id-goes-here"
  });

  // we also have "batching" via sending an array of
  // messages
  await sender.sendBatch([
    {
      body: "message body"
    }
  ]);
}

export async function sample4Peek() {
  // ## 4. Peeking via the $management API (ie, no locking)
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  // without sessions
  // all peek() calls return ReceivedMessageInfo[]
  await queueClient.peek(maxMessageCount);
  await queueClient.peekBySequenceNumber(sequenceNumber, maxMessageCount);

  // with sessions (requires a receiver)
  const receiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
    sessionId: "session-id-goes-here"
  });

  await receiver.peek(maxMessageCount);
  await receiver.peekBySequenceNumber(sequenceNumber);
}

export async function sample5AutoCommitWithoutSessions() {
  // ## 5. Receiving: using auto-commit
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  // in JS the "session" concept is decided when you
  // createReceiver().
  //
  // You'll either get a `SessionReceiver` by specifying
  // a session ID or a normal`Receiver`
  const receiver: Receiver = queueClient.createReceiver(ReceiveMode.peekLock);

  receiver.registerMessageHandler(
    // onMessage
    async (event: ServiceBusMessage) => {
      // throwing an error will stop auto-completion
      // otherwise doing nothing will cause it to complete() the
      // message.
      throw new Error();
    },
    // onError
    (err: Error) => {
      // errors here
    },
    {
      autoComplete: true,
      // other options:
      // extending auto renewal lock duration
      maxMessageAutoRenewLockDurationInSeconds: 100
    }
  );
}

export async function sample6SchedulingAndCancellingMessages() {
  // ## 6. Sending: scheduling and cancelling scheduled messages
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");
  const sender: Sender = queueClient.createSender();

  const messageSequenceId: Long = await sender.scheduleMessage(scheduledTimeUTC, {
    body: "hello",
    // session-id is optional but it's easy to swap between the two modes
    sessionId: "optional session ID"
  });

  await sender.cancelScheduledMessage(messageSequenceId);
}

export async function sample7ReceivingAndSettlingDeferredMessages() {
  // ## 7. Receiving and settling of deferred messages
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  // Or create a `sessionReceiver`. Technique is the same.
  const receiver: Receiver = queueClient.createReceiver(ReceiveMode.peekLock);

  // returns an array ServiceBusMessage

  await receiver.receiveDeferredMessages([sequenceNumber, otherSequenceNumber]);

  // NOTE: I don't see a way to do the same but with a push model (ie, with a handler)
}

export async function sample8RenewingLocksForSessionsAndMessages() {
  // ## 8. Renewing message lock
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");
  const receiver: Receiver = queueClient.createReceiver(ReceiveMode.peekLock);

  const lockTokenString: string = "";
  const serviceBusMessage: ServiceBusMessage = getServiceBusMessageSomehow();

  // you can do it uses a specific lock token string
  // or using a message you've already received.
  //
  // returns what I assume is the next expiration date of the
  // token
  await receiver.renewMessageLock(lockTokenString);
  await receiver.renewMessageLock(serviceBusMessage);
}

export async function sample9RenewingSessionLock() {
  // ## 9. Renewing session lock
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  const sessionReceiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
    sessionId: "session-id-goes-here"
  });

  // returns the next date to renew
  //
  // note that we have some autocommit facilities that
  // seem to take into account renewal so there might be something
  // more advanced I haven't seen yet.
  await sessionReceiver.renewSessionLock();
}

export async function sample9SessionState() {
  // ## 10. Set and get session state
  const serviceBusClient: ServiceBusClient = ServiceBusClient.createFromConnectionString(
    "connection-string"
  );
  const queueClient: QueueClient = serviceBusClient.createQueueClient("queue-name");

  const sessionReceiver: SessionReceiver = queueClient.createReceiver(ReceiveMode.peekLock, {
    sessionId: "session-id-goes-here"
  });

  // NOTE that the type passed here is 'any'. Not sure of what
  // the serialization rules are.
  await sessionReceiver.setState("some state for someone in the future");
  sessionReceiver.getState();
}

// just for the samples, don't care about the values.
const maxMessageCount = 1; // default
const sequenceNumber = new Long(0);
const otherSequenceNumber = new Long(0);
const scheduledTimeUTC = new Date();

function getServiceBusMessageSomehow(): ServiceBusMessage {
  throw new Error("Only for demo purposes");
}
