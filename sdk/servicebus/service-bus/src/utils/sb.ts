// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import minimist from "minimist";
import { ServiceBusClient } from "../serviceBusClient";
import * as dotenv from "dotenv";
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceBusReceiver } from "../receivers/receiver";
import { ServiceBusReceivedMessage } from "../serviceBusMessage";
import { createInterface } from "readline";
import { loadArgFromFileOrText } from "./cli";

dotenv.config();

interface AuthenticationArgs {
    connectionString?: string;
    // or
    useEnv?: boolean;
    // or
    dotEnv?: boolean;
    // or
    defaultAzureCredential?: boolean;
    serviceBusNamespace?: string;
}

type PeekArgs = AuthenticationArgs & {
    entity?: string;
    deadLetter?: boolean;
    count?: number;
};

class ArgsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ArgsError";
    }
}

const authenticationMinimistOpts = {
    alias: {
        "cs": "connectionString",
        "env": "useEnv"
    }, boolean: [
        "useEnv"
    ], string: [
        "defaultAzureCredential",
        "serviceBusNamespace"
    ]
};

function mergeMinimistArgs(...args: minimist.Opts[]) {
    const finalArgs: minimist.Opts = {
        boolean: [],
        string: [],
        alias: {}
    };

    for (const arg of args) {
        finalArgs.alias = {
            ...finalArgs.alias,
            ...(arg.alias ?? {})
        };

        if (Array.isArray(arg.string)) {
            (finalArgs.string as string[]).push(...(arg.string as string[]));
        }

        if (Array.isArray(arg.boolean)) {
            (finalArgs.boolean as string[]).push(...(arg.boolean as string[]));
        }
    }

    return finalArgs;
}

function getConnectionStringFromEnvironment(): string {
    const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;

    if (connectionString == null) {
        throw new ArgsError("A connection string must be set in the environment variable 'SERVICEBUS_CONNECTION_STRING'");
    }

    return connectionString;
}

const helpText = `Usage:`;

async function main() {
    // check that first argument - it's the "mode"
    if (process.argv.length < 3) {
        throw new ArgsError("No mode specified");        
    }

    const mode = process.argv[2];
    
    switch (mode) {
        case "peek": {
            const minimistOpts = mergeMinimistArgs(authenticationMinimistOpts, {
                string: [ "entity" ],
            });

            const parsedArgs = minimist(process.argv.slice(3), minimistOpts) as PeekArgs;

            if (parsedArgs.entity == null) {
                throw new ArgsError("Entity should be specified using --entity");
            }

            const serviceBusClient = createServiceBusClient(parsedArgs);
            const receiver = serviceBusClient.createReceiver(parsedArgs.entity);

            await peekMessages(receiver);
            break;
        }
        case "receiveAndDelete": {
            const minimistOpts = mergeMinimistArgs(authenticationMinimistOpts, {
                string: [ "entity" ]
            });

            const parsedArgs = minimist(process.argv.slice(3), minimistOpts) as PeekArgs;

            if (parsedArgs.entity == null) {
                throw new ArgsError("Entity should be specified using --entity");
            }

            const serviceBusClient = createServiceBusClient(parsedArgs);
            const receiver = serviceBusClient.createReceiver(parsedArgs.entity);

            receiver.subscribe({
                processError: async (errContext) => {
                    console.error(`WARNING: ${errContext.error}`);
                },
                processMessage: async (message) => {
                    printMessage(message);
                }
            });

            break;
        }
        case "send": {
            const minimistOpts = mergeMinimistArgs(authenticationMinimistOpts, {
                string: [ "entity" ]
            });

            const parsedArgs = minimist(process.argv.slice(3), minimistOpts) as PeekArgs;

            if (parsedArgs.entity == null) {
                throw new ArgsError("Entity should be specified using --entity");
            }

            const serviceBusClient = createServiceBusClient(parsedArgs);
            const sender = serviceBusClient.createSender(parsedArgs.entity);
            
            const readlineInterface = createInterface({
                terminal: false,
                input: process.stdin,
                output: process.stdout
            });

            const sendPromises: Promise<void>[] = [];

            readlineInterface.on('line', (line) => {
                sendPromises.push(sender.sendMessages(loadArgFromFileOrText(line)));
            });
            
            readlineInterface.on('close', () => {
                Promise.all(sendPromises)
                    .catch((err) => {
                        console.error(err);
                    })
                    .then(() => serviceBusClient.close())
                    .then(() => {
                        process.exit(1);
                    });
            });

            break;
        }
        default: {
            throw new ArgsError(`Invalid mode '${mode}'`);
        }
    }
}

main().catch((err) => {
    console.log(`Error: ${err}`);

    if (err.name === "ArgsError") {
        console.error(helpText);
    } else {
        console.error("Error thrown:", err);
    }

    process.exit(1);
});

function createServiceBusClient(parsedArgs: AuthenticationArgs) {
    if (parsedArgs.connectionString) {
        return new ServiceBusClient(parsedArgs.connectionString);
    } else if (parsedArgs.dotEnv) {
        // expect that:
        // SERVICEBUS_CONNECTION_STRING is defined in the environment
        dotenv.config();
        return new ServiceBusClient(getConnectionStringFromEnvironment());
    } else if (parsedArgs.useEnv) {
        return new ServiceBusClient(getConnectionStringFromEnvironment());
    } else if (parsedArgs.defaultAzureCredential && parsedArgs.serviceBusNamespace) {
        return new ServiceBusClient(parsedArgs.serviceBusNamespace, new DefaultAzureCredential());
    } else {
        throw new ArgsError("No authentication mechanism specified.");
    }
}

async function peekMessages(receiver: ServiceBusReceiver) {
    while (true) {
        let messages = await receiver.peekMessages(10);
    
        for (const message of messages) {
            printMessage(message);
        }
    }
}

function printMessage(message: ServiceBusReceivedMessage, fields: (keyof ServiceBusReceivedMessage)[] = [ "body", "messageId" ]) {
    const newMessage: any = {};

    for (const field of fields) {
        newMessage[field] = message[field];
    }

    console.log(JSON.stringify(newMessage));
}
