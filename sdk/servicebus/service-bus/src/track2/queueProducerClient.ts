import { SendableMessage } from "./models";
import { ServiceBusClientOptions, ServiceBusClient } from "../serviceBusClient";
import { QueueClient } from "../queueClient";
import { Sender } from "../sender";

export class QueueProducerClient {
  private _sbClient: ServiceBusClient;
  private _queueClient: QueueClient;
  private _sender: Sender;

  constructor(connectionString: string, queueName: string, options?: ServiceBusClientOptions) {
    this._sbClient = ServiceBusClient.createFromConnectionString(connectionString, options);
    this._queueClient = this._sbClient.createQueueClient(queueName);
    this._sender = this._queueClient.createSender();
  }

  async send(message: SendableMessage): Promise<void> {
    return this._sender.send(message);
  }

  async schedule(scheduledEnqueueTimeUtc: Date, message: SendableMessage): Promise<Long> {
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
