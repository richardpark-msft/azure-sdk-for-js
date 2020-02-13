import { SendableMessage, SenderClient, QueueSenderClientOptions } from "./models";
import { ServiceBusClient } from "../serviceBusClient";
import { QueueClient } from "../queueClient";
import { Sender } from "../sender";

export class QueueSenderClient implements SenderClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  private _sender: Sender;

  constructor(queueConnectionString: string, options?: QueueSenderClientOptions);
  constructor(serviceBusConnectionString: string, queueName: string, options?: QueueSenderClientOptions);
  constructor(queueOrServiceBusConnectionString1: string, queueNameOrOptions2?: string | QueueSenderClientOptions, options3?: QueueSenderClientOptions) {
    if (typeof queueNameOrOptions2 === "string") {
      const serviceBusConnectionString = queueOrServiceBusConnectionString1;
      const queueName = queueNameOrOptions2;
      const options: undefined | QueueSenderClientOptions = options3;

      this._sbClient = new ServiceBusClient(serviceBusConnectionString, options);
      this._queueClient = this._sbClient.createQueueClient(queueName);
    } else {
      const queueConnectionString = queueOrServiceBusConnectionString1;
      const options: undefined | QueueSenderClientOptions = queueNameOrOptions2;

      // snag the entity name from the connection string
      const entityPathMatch = queueConnectionString.match(/^.+EntityPath=(.+?);{0,1}$/);

      if (entityPathMatch!.length !== 2) {
        throw new Error("Invalid queue connection string - no EntityPath");
      }

      this._sbClient = new ServiceBusClient(queueConnectionString, options);
      this._queueClient = this._sbClient.createQueueClient(entityPathMatch![1]);
    }

    this._sender = this._queueClient.createSender();
  }

  async send(message: SendableMessage): Promise<void> {
    return this._sender.send(message);
  }

  async scheduleMessage(scheduledEnqueueTimeUtc: Date, message: SendableMessage): Promise<Long> {
    return this._sender.scheduleMessage(scheduledEnqueueTimeUtc, message);
  }

  async cancelScheduledMessage(sequenceNumber: Long): Promise<void> {
    return this._sender.cancelScheduledMessage(sequenceNumber);
  }

  async close() {
    await this._sbClient.close();
    await this._queueClient.close();
    await this._sender.close();
  }
}
