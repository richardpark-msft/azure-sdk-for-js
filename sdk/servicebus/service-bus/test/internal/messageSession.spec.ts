// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const assert = chai.assert;

describe("MessageSession", () => {
  describe("process* handlers", () => {
    it("processClose() is called if the entire receiver is shut down", () => {
      assert.fail("Not implemented");
    });
    it("processClose() is not called multiple times if the receiver is closed and it was manually stopped.", () => {
      assert.fail("Not implemented");
    });
    it("processOpen and processClose are called for sessions", async () => {
      assert.fail("Not implemented");
    });

    // TODO: this is a `MessageSession` test. (same for all tests applies above)
    it("processOpen and processClose are called for non-sessions", async () => {
      assert.fail("Not implemented");
    });
  });
});
