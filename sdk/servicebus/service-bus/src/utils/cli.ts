// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { readFileSync } from "fs";

/**
 * @internal
 */
export function loadArgFromFileOrText(arg: string): { body: string } {
  let text = arg;
  if (arg[0] === "@") {
    text = readFileSync(arg.slice(1)).toString();
  }

  // is the text actually a serialized ServiceBusMessage?
  try {
    const possibleMessage = /** @type {import("@azure/service-bus").ServiceBusMessage} */ JSON.parse(
      text
    );

    if (possibleMessage.body != null) {
      // let's just assume it is a service bus message
      return possibleMessage;
    }
  } catch (_err) {}

  // if there are JSON related errors or it doesn't have a 'body' field let's just assume it's text and
  // just send it in the body.
  return {
    body: text
  };
}
