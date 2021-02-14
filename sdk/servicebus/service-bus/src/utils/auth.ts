// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import yargs from "yargs";
import { ServiceBusClient } from "../serviceBusClient";
import * as dotenv from "dotenv";
import { DefaultAzureCredential } from "@azure/identity";

/**
 * @internal
 */
export interface AuthOptions {
    connectionstring: string | undefined;
    env: boolean | undefined;
    namespace: string | undefined;
}

/**
 * @param {yargs.CommandBuilder} yargs 
 * @internal
 */
export function addAuthenticationGroupToBuilder(yargs: yargs.Argv<{}>) : yargs.Argv<AuthOptions> {
    return yargs.option("connectionstring", {
        group: "Authentication:",
        string: true,
        nargs: 1,
        conflicts: ["env", "namespace"]
    }).option("env", {
        group: "Authentication:",
        description: "Load a .env file from the specified directory, then look for SERVICEBUS_CONNECTION_STRING in the environment",
        boolean: true,
        conflicts: ["connectionstring", "namespace"]
    }).option("namespace", {
        group: "Authentication:",
        alias: ["ns"],
        description: "Service Bus namespace name. Automatically uses the DefaultAzureCredential for authentication",
        string: true,
        nargs: 1,
        conflicts: ["connectionstring", "env"]
    });
}

/**
 * @internal
 */
export function createServiceBusClient(parsedArgs: AuthOptions) {
    if (parsedArgs.connectionstring) {
      return new ServiceBusClient(parsedArgs.connectionstring);
    } else if (parsedArgs.env) {
      dotenv.config();
      return new ServiceBusClient(getConnectionStringFromEnvironment());
    } else if (parsedArgs.namespace) {
      return new ServiceBusClient(parsedArgs.namespace, new DefaultAzureCredential());
    } else {
      throw new Error("No authentication method specified");
    }
  }

function getConnectionStringFromEnvironment(): string {
    if (!process.env.SERVICEBUS_CONNECTION_STRING) {
        throw new Error("SERVICEBUS_CONNECTION_STRING was not defined in the environment");
    }

    return process.env.SERVICEBUS_CONNECTION_STRING;
}
  