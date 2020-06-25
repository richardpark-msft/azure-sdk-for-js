// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { createServiceBusClientForTests, ServiceBusClientForTests } from "./utils/testutils2";
import { ReceivedMessageWithLock, Receiver } from "../src";
import { TestClientType } from "./utils/testUtils";

describe("new style iterator", () => {
  let serviceBusClient: ServiceBusClientForTests;

  before(async () => {
    serviceBusClient = await createServiceBusClientForTests({});
  });

  after(() => {
    return serviceBusClient.test.after();
  });

  describe("no sessions", () => {
    let receiver: Receiver<ReceivedMessageWithLock>;

    beforeEach(async () => {
      const entities = await serviceBusClient.test.createTestEntities(
        TestClientType.UnpartitionedQueue
      );

      receiver = await serviceBusClient.test.getPeekLockReceiver(entities);
    });

    afterEach(() => {
      return serviceBusClient.test.afterEach();
    });

    it("iterate and abort", () => {
      receiver.getMessageIterator();
    });

    it("iterate and time out", () => {});

    it("iterate normally", () => {});

    it("closing iterator (and receiver)", () => {});

    it("recovery", () => {});

    it("closing receiver closes iterator gracefully", () => {});

    it("non-fatal errors are delivered to the user (somehow?)", () => {});
  });

  describe("with sessions", () => {
    it("iterate and abort", () => {});

    it("iterate and time out", () => {});

    it("iterate normally", () => {});

    it("closing iterator (and receiver)", () => {});

    it("recovery", () => {});

    it("closing receiver closes iterator gracefully", () => {});

    it("non-fatal errors are delivered to the user (somehow?)", () => {});
  });
});
