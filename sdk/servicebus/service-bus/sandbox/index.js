const dotenv = require("dotenv");
dotenv.config();

const { ServiceBusClient } = require("@azure/service-bus");
const appInsights = require("applicationinsights");

appInsights.setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(false)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
    .start();

const defaultClient = appInsights.defaultClient;

const connectionString = process.env.SERVICEBUS_CONNECTION_STRING;

if (connectionString == null) {
    throw new Error("Failed to get connection string");
}

const client = new ServiceBusClient(connectionString);
const senderClient = new ServiceBusClient(connectionString);

async function sendMessagesForever() {
    let numberMessagesSent = 0;

    return new Promise(async () => {
        console.log(`Started message sending`);

        /** @type {import("@azure/service-bus").ServiceBusSender | undefined} */
        let sender = senderClient.createSender("longevitytests");

        while (await new Promise((resolve) => setTimeout(() => resolve(true), 1000))) {            
            try {
                if (sender == null) {
                    sender = senderClient.createSender("longevitytests");
                }
                
                await sender.sendMessages({
                    body: `Message: ${Date.now()}`
                });

                ++numberMessagesSent;

                if (numberMessagesSent !== 0 && numberMessagesSent % 30 === 0) {
                    defaultClient.trackMetric({
                        name: "messagesSent",
                        value: numberMessagesSent
                    });
                }

            } catch (err) {
                console.log(`Sending message failed: `, err);
                defaultClient.trackException({
                    exception: err,
                    properties: {
                        from: "sender",
                        numMessagesSentSoFar: numberMessagesSent
                    }
                })
                sender = undefined;
            }
        }
    });
}

async function main() {
    defaultClient.trackEvent({
        name: "ApplicationStart"        
    });

    const receiver = client.createReceiver("longevitytests", "longevitySub", {
        receiveMode: "peekLock"
    });

    let numMessagesReceived = 0;
    let numMessagesCompleted = 0;
    let lastTimeReceived = Date.now();

    console.log(`Subscribing...`);

    receiver.subscribe({
        processMessage: async (msg) => {
            ++numMessagesReceived;

            defaultClient.trackEvent({
                name: "messageReceived",
                properties: {
                    numMessagesReceived,
                    timeSinceLastMessageMs: Date.now() - lastTimeReceived
                }
            });

            lastTimeReceived = Date.now();
            await receiver.completeMessage(msg);
            ++numMessagesCompleted;
        },
        processError: async (err) => {
            console.log(`subscribe error:`, err);

            defaultClient.trackException({
                exception: err.error,
                properties: {
                    from: "subscribe",
                    numMessagesCompleted,
                    numMessagesReceived
                }
            });
        }
    }, {
        autoCompleteMessages: false,
        maxConcurrentCalls: 10,
    });

    return sendMessagesForever();
}

main().catch((err) => {
    console.log(`Fatal error: ${err}`);

    defaultClient.trackException({
        exception: err,
        properties: {
            from: "application",
            quitting: true
        }
    })
}).then(() => { 
    console.log(`Exiting...`);
    defaultClient.flush();
    client.close().then(() => senderClient.close());
});