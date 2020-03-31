import { assertValidMessageHandlers } from "../../src/receivers/shared";
import * as chai from "chai";
const should = chai.should();

describe("assertValidMessageHandlers", () => {
  const badProcessError = [
    {
      processMessage: async () => {},
      processError: "not a function"
    },
    {
      processMessage: async () => {}
      // missing processError()
    }
  ];
  const badProcessMessage = [
    {
      // missing processMessage()
      processError: async () => {}
    },
    {
      processMessage: "not a function",
      processError: async () => {}
    }
  ];

  badProcessError.forEach((handler, index) => {
    it(`processError checks [${index}]`, () => {
      should.throw(
        () => assertValidMessageHandlers(handler),
        /Invalid MessageHandlers methods provided - these need to be functions \(processError\)./
      );
    });
  });

  badProcessMessage.forEach((handler, index) => {
    it(`processMessage checks [${index}]`, () => {
      should.throw(
        () => assertValidMessageHandlers(handler),
        /Invalid MessageHandlers methods provided - these need to be functions \(processMessage\)./
      );
    });
  });

  it("undefined or empty handlers", () => {
    should.throw(() => assertValidMessageHandlers(undefined), /MessageHandlers was undefined/);
    should.throw(
      () => assertValidMessageHandlers({}),
      /Invalid MessageHandlers methods provided - these need to be functions \(processMessage,processError\)./
    );
  });

  it("everything's okay", () => {
    assertValidMessageHandlers({
      processError: () => {},
      processMessage: () => {}
    });
  });
});
