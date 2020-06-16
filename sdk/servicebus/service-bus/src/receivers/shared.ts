// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { GetMessageIteratorOptions } from "../models";
import { Receiver } from "./receiver";

/**
 * @internal
 * @ignore
 */
export function assertValidMessageHandlers(handlers: any): void {
  if (
    handlers &&
    handlers.processMessage instanceof Function &&
    handlers.processError instanceof Function &&
    (handlers.processClose == null || handlers.processClose instanceof Function) &&
    (handlers.processOpen == null || handlers.processOpen instanceof Function)
  ) {
    return;
  }

  throw new TypeError('Invalid "MessageHandlers" provided.');
}

/**
 * @internal
 * @ignore
 */
export async function* getMessageIterator<ReceivedMessageT>(
  receiver: Receiver<ReceivedMessageT>,
  options?: GetMessageIteratorOptions
): AsyncIterableIterator<ReceivedMessageT> {
  while (true) {
    const messages = await receiver.receiveBatch(1, options);

    // In EventHubs we've had a concept of "punctuation" (thanks @jsquire) that
    // allows the user, when working in a model like this, to get a periodic "no message
    // arrived in this window of time" notification.
    //
    // TODO: do we want this same behavior for ServiceBus?
    if (messages.length === 0) {
      continue;
    }

    yield messages[0];
  }
}
