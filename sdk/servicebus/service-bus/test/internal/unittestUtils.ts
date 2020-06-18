// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ClientEntityContext } from "../../src/clientEntityContext";
import { AwaitableSender, Receiver as RheaReceiver } from "rhea-promise";
import { DefaultDataTransformer, AccessToken } from "@azure/core-amqp";
import { EventEmitter } from "events";

export function createClientEntityContextForTests(options?: {
  onCreateAwaitableSenderCalled?: () => void;
  onCreateReceiverCalled?: (fakeReceiver: RheaReceiver) => void;
}): ClientEntityContext & { initWasCalled: boolean } {
  let initWasCalled = false;

  const fakeClientEntityContext = {
    entityPath: "queue",
    sender: {
      credit: 999
    },
    namespace: {
      config: { endpoint: "my.service.bus" },
      connectionId: "connection-id",
      connection: {
        createAwaitableSender: async (): Promise<AwaitableSender> => {
          if (options?.onCreateAwaitableSenderCalled) {
            options.onCreateAwaitableSenderCalled();
          }

          const testAwaitableSender = ({
            setMaxListeners: () => testAwaitableSender
          } as any) as AwaitableSender;

          return testAwaitableSender;
        },
        createReceiver: async (): Promise<RheaReceiver> => {
          const fakeReceiver = new EventEmitter() as RheaReceiver;

          // eslint-disable-next-line @typescript-eslint/no-empty-function
          fakeReceiver["addCredit"] = () => {};

          if (options?.onCreateReceiverCalled) {
            options.onCreateReceiverCalled(fakeReceiver);
          }

          return fakeReceiver;
        }
      },
      dataTransformer: new DefaultDataTransformer(),
      tokenCredential: {
        getToken() {
          return {} as AccessToken;
        }
      },
      cbsSession: {
        cbsLock: "cbs-lock",
        async init() {
          initWasCalled = true;
        },
        async negotiateClaim(): Promise<void> {}
      }
    },
    initWasCalled
  };

  return (fakeClientEntityContext as any) as ReturnType<typeof createClientEntityContextForTests>;
}

export function getPromiseResolverForTest(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
} {
  let resolver: () => void;
  let rejecter: (err: Error) => void;

  const promise = new Promise<void>((resolve, reject) => {
    resolver = resolve;
    rejecter = reject;
  });

  return {
    promise,
    resolve: resolver!,
    reject: rejecter!
  };
}
