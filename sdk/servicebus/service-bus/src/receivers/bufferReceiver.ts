// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Receiver, ReceiverEvents, EventContext } from "rhea-promise";
import { DefaultDataTransformer } from "@azure/core-amqp";

export function messageIterator(
  receiver: Receiver,
  initialCredits: number
): AsyncIterableIterator<string> & { close(): Promise<void> } {
  const iterator = _iterator(receiver, initialCredits) as ReturnType<typeof messageIterator>;

  iterator.close = async () => {
    return new Promise((resolve) => {
      receiver.drain = true;
      receiver.addCredit(1);

      receiver.once(ReceiverEvents.receiverDrained, () => {
        resolve();
      });
    });
  };

  return iterator;
}

// TODO: first pass - infinite interator
async function* _iterator(
  receiver: Receiver,
  initialCredits: number
): AsyncIterableIterator<string> {
  let promise = setupReceiver(receiver);

  console.log(`Adding in ${initialCredits}`);
  receiver.addCredit(initialCredits);

  while (true) {
    let message: string;
    console.log(`Awaiting on promise for message`);
    ({ message, promise } = await promise);
    console.log(`Yielding next message: ${message}`);
    yield message;
    console.log(`Done yielding, adding 1 credit`);
    receiver.addCredit(1);
  }
}

interface PromisePayload {
  promise: Promise<PromisePayload>;
  message: string;
}

function setupReceiver(receiver: Receiver): Promise<PromisePayload> {
  let { promise, resolve, reject } = deconstructPromise<PromisePayload>();
  const transformer = new DefaultDataTransformer();

  receiver.on(ReceiverEvents.message, ({ message }: EventContext) => {
    console.log(`Message arrived: ${message!.body}`);
    const oldResolve = resolve;
    ({ promise, resolve, reject } = deconstructPromise<PromisePayload>());

    console.log(`Creating service bus message`);

    // const message = new ServiceBusMessageImpl(
    //   {} as ClientEntityContext,
    //   ec.message!,
    //   ec.delivery!,
    //   // TODO: um...maybe? Maybe not? Need to look.
    //   false
    // );

    console.log(`Calling oldResolve with message and next new promise`);
    oldResolve({
      promise,
      // TODO: temporary, the SBMI requires a ClientEntityContext and...whatever.
      message: transformer.decode(message?.body)
    });
  });

  receiver.on(ReceiverEvents.receiverError, ({ error }: EventContext) => {
    console.log(`Error:`, error);
    reject(error!);
  });

  return promise;
}

function deconstructPromise<T>(): {
  promise: Promise<T>;
  resolve: (arg: T) => void;
  reject: (err: Error) => void;
} {
  let externalResolve: () => void;
  let externalReject: (err: Error) => void;

  const promise = new Promise<T>((resolve, reject) => {
    externalResolve = resolve;
    externalReject = reject;
  });

  return {
    promise,
    // guaranteed to be initialized by the immediately run constructor of Promise
    resolve: externalResolve!,
    reject: externalReject!
  };
}
