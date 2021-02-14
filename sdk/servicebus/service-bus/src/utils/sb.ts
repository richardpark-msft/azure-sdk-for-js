// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import yargs from "yargs";
import { ServiceBusReceiver } from "../receivers/receiver";
import { addAuthenticationGroupToBuilder, AuthOptions, createServiceBusClient } from "./auth";

async function main() {
  yargs(process.argv.slice(2))
    .command({
      command: "peek <entity>",
      describe: "Peek messages from an entity of the format 'queue' or 'subscription'",
      builder: (yargs) => {
        return addAuthenticationGroupToBuilder(yargs)
          .option("entity", {
            group: "Arguments",
            description:
              "The entity to peek messages from (either: 'queue' or 'topic/subscription')",
            string: true,
            nargs: 1,
            demandOption: true
          })
          .option("properties", {
            group: "Arguments",
            alias: ["p"],
            description:
              "The fields to extract from the message. These can be any field in the type ServiceBusReceivedMessage",
            array: true,
            default: ["body", "messageId"]
          })
          .option("number", {
            group: "Arguments",
            alias: ["n"],
            description: "Causes a leading number to be printed before each line",
            default: false,
            boolean: true
          });
      },
      handler: async (
        argv: AuthOptions & { entity?: string; properties?: string[]; number?: boolean }
      ) => {
        const serviceBusClient = createServiceBusClient(argv);
        try {
          const receiver = serviceBusClient.createReceiver(argv.entity!);
          await peekMessages(receiver, argv.properties!, !!argv.number);
        } finally {
          await serviceBusClient.close();
        }
      }
    })
    .command({
      command: "receive <entity>",
      describe:
        "Receive (and delete) messages from an entity of the format 'queue' or 'topic/subscription'",
      builder: addAuthenticationGroupToBuilder,
      handler: (_argv) => {}
    })
    .command({
      command: "send <entity>",
      describe:
        "Receive (and delete) messages from an entity of the format 'queue' or 'topic/subscription'",
      builder: (yargs) => {
        return addAuthenticationGroupToBuilder(yargs);
      },
      handler: (_argv) => {
        // const serviceBusClient = createServiceBusClient(argv);
      }
    })
    .command({
      command: "sample <sample name>",
      describe: "Install a sample program into this project",
      builder: (yargs) => {
        return yargs;
      },
      handler: (_argv) => {}
    })
    .demandCommand()
    .strictCommands()
    .help().argv;
}

main().catch((err) => {
  console.log(`Error: ${err}`);
  process.exit(1);
});

async function peekMessages(
  receiver: ServiceBusReceiver,
  properties: string[],
  shouldNumber: boolean
) {
  const printMessage = createPrintMessageFn(properties, shouldNumber);

  while (true) {
    let messages = await receiver.peekMessages(10);

    for (const message of messages) {
      printMessage(message);
    }
  }
}

function createPrintMessageFn(properties: string[], shouldNumber: boolean) {
  let messageNumber: number | undefined;

  if (shouldNumber) {
    messageNumber = 1;
  }

  return (message: any) => {
    const newMessage: any = {};

    for (const field of properties) {
      newMessage[field] = message[field];
    }

    if (messageNumber != null) {
      console.log(`${messageNumber++}. ${JSON.stringify(newMessage)}`);
    } else {
      console.log(JSON.stringify(newMessage));
    }
  };
}
