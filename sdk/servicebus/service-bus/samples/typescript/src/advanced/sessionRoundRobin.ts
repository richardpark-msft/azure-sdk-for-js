/*
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the MIT Licence.

  This sample demonstrates how you can continually read through all the available
  sessions in a Service Bus queue or subscription.

  Run the sendMessages sample with different session ids before running this sample.
*/

import {
  ServiceBusClient,
  delay,
  ReceivedMessageWithLock,
  SessionReceiver,
  MessagingError
} from "@azure/service-bus";
import * as dotenv from "dotenv";
import { env } from "process";
import { AbortController } from "@azure/abort-controller";

dotenv.config();

const serviceBusConnectionString =
  env["SERVICEBUS_CONNECTION_STRING"] || "<service bus connection string not in environment>";

// NOTE: this sample uses a queue but would also work a session enabled subscription.
const queueName = env["QUEUE_NAME_WITH_SESSIONS"] || "<queue name not in environment>";

const maxSessionsToProcessSimultaneously = 8;
const sessionIdleTimeoutMs = 3 * 1000;
const delayOnErrorMs = 5 * 1000;

// this can be used control when the round-robin processing will terminate.
const abortController = new AbortController();

// called just before we start processing the first message of a session
async function processInitialize(sessionId: string) {
  console.log(`[${sessionId}] will start processing...`);
}

// called when we get a message for a session
async function processMessage(msg: ReceivedMessageWithLock) {
  console.log(`[${msg.sessionId}] received message with body ${msg.body}`);
}

// called if we get an error
async function processError(err: Error, sessionId?: string) {
  if (sessionId) {
    console.log(`Error when receiving messages from the session ${sessionId}: `, err);
  } else {
    console.log(`Error when creating the receiver for next available session`, err);
  }
}

// Called if we are closing a session
// `reason` will be:
// * 'error' if we are closing because of an error(the error will be delivered
//   to `processError` above)
// * 'idle_timeout' if `sessionIdleTimeoutMs` milliseconds pass without
//   any messages being received (ie, session can be considered empty).
//
async function processClose(reason: "error" | "idle_timeout", sessionId: string) {
  console.log(`[${sessionId}] was closed because of ${reason}`);
}

// utility function to create a timer that can be refreshed
function createRefreshableTimer(timeoutMs: number, resolve: Function): () => void {
  let timer: any;

  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => resolve(), timeoutMs);
  };
}

// Queries Service Bus for the next available session and processes it.
async function receiveFromNextSession(serviceBusClient: ServiceBusClient): Promise<void> {
  let sessionReceiver: SessionReceiver<ReceivedMessageWithLock>;

  try {
    sessionReceiver = await serviceBusClient.createSessionReceiver(queueName, "peekLock", {
      autoRenewLockDurationInMs: sessionIdleTimeoutMs
    });
  } catch (err) {
    if (
      (err as MessagingError).code === "SessionCannotBeLockedError" ||
      (err as MessagingError).code === "OperationTimeoutError"
    ) {
      console.log(`INFO: no available sessions, sleeping for ${delayOnErrorMs}`);
    } else {
      await processError(err, undefined);
    }

    await delay(delayOnErrorMs);
    return;
  }

  await processInitialize(sessionReceiver.sessionId);

  const sessionFullyRead = new Promise((resolveSessionAsFullyRead, rejectSessionWithError) => {
    const refreshTimer = createRefreshableTimer(sessionIdleTimeoutMs, resolveSessionAsFullyRead);
    refreshTimer();

    sessionReceiver.subscribe(
      {
        async processMessage(msg) {
          refreshTimer();
          await processMessage(msg);
        },
        async processError(err) {
          rejectSessionWithError(err);
        }
      },
      {
        abortSignal: abortController.signal
      }
    );
  });

  try {
    await sessionFullyRead;
    await processClose("idle_timeout", sessionReceiver.sessionId);
  } catch (err) {
    await processError(err, sessionReceiver.sessionId);
    await processClose("error", sessionReceiver.sessionId);
  } finally {
    await sessionReceiver.close();
  }
}

async function roundRobinThroughAvailableSessions(): Promise<void> {
  const serviceBusClient = new ServiceBusClient(serviceBusConnectionString);

  for (let i = 0; i < maxSessionsToProcessSimultaneously; ++i) {
    (async () => {
      while (!abortController.signal.aborted) {
        await receiveFromNextSession(serviceBusClient);
      }
    })();
  }

  console.log(`Listening for available sessions...`);
}

// To stop the round-robin processing you can just call abortController.abort()
roundRobinThroughAvailableSessions().catch((err) => console.log(`Fatal error: ${err}`));
