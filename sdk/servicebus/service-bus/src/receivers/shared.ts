// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { GetMessageIteratorOptions } from "../models";
import { Receiver } from "./receiver";
import { MessageHandlers } from "..";

/**
 * @internal
 * @ignore
 */
export function assertValidMessageHandlers(handlers: any) {
  const actualHandlers = handlers as MessageHandlers<{}>;

  if (!actualHandlers) {
    throw new TypeError("MessageHandlers was undefined");
  }

  const missingOrBadMethods = [];

  if (!(actualHandlers.processMessage instanceof Function)) {
    missingOrBadMethods.push("processMessage");
  }

  if (!(actualHandlers.processError instanceof Function)) {
    missingOrBadMethods.push("processError");
  }

  if (missingOrBadMethods.length > 0) {
    throw new TypeError(
      `Invalid MessageHandlers methods provided - these need to be functions (${missingOrBadMethods.join(
        ","
      )}).`
    );
  }
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
