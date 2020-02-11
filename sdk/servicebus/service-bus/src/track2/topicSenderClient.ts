import { SendableMessage, TopicSenderClientOptions, SenderClient } from "./models";
import { ServiceBusClient } from "../serviceBusClient";
import { Sender } from "../sender";
import { TopicClient } from '../topicClient';

export class TopicSenderClient implements SenderClient {
  private _sbClient: ServiceBusClient;
  private _topicClient: TopicClient;
  private _sender: Sender;

  constructor(topicConnectionString: string, options?: TopicSenderClientOptions);
  constructor(serviceBusConnectionString: string, topicName: string, options?: TopicSenderClientOptions);
  constructor(topicConnectionStringOrServiceBusConnectionString1: string, topicOrOptions2?: string | TopicSenderClientOptions, options3?: TopicSenderClientOptions) {
    if (typeof topicOrOptions2 === "string") {
      const serviceBusConnectionString = topicConnectionStringOrServiceBusConnectionString1;
      const topicName = topicOrOptions2;
      const options: undefined | TopicSenderClientOptions = options3;

      this._sbClient = ServiceBusClient.createFromConnectionString(serviceBusConnectionString, options);
      this._topicClient = this._sbClient.createTopicClient(topicName);
    } else {
      const topicConnectionString = topicConnectionStringOrServiceBusConnectionString1;
      const options: undefined | TopicSenderClientOptions = topicOrOptions2;

      // snag the entity name from the connection string
      const entityPathMatch = topicConnectionString.match(/^.+EntityPath=(.+?);{0,1}$/);

      if (entityPathMatch!.length !== 2) {
        throw new Error("Invalid topic connection string - no EntityPath");
      }

      this._sbClient = ServiceBusClient.createFromConnectionString(topicConnectionString, options);
      this._topicClient = this._sbClient.createTopicClient(entityPathMatch![1]);
    }

    this._sender = this._topicClient.createSender();
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
    await this._topicClient.close();
    await this._sender.close();
  }
}