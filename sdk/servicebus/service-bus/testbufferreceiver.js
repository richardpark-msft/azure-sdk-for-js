const { ServiceBusClient } = require("./dist");
const dotenv = require("dotenv");
const { env } = require("process");
dotenv.config();

(async () => {
  console.log(`Starting...`);
  const client = new ServiceBusClient(env["SERVICE_BUS_CONNECTION_STRING"]);
  const sender = client.createSender("samples.queue");

  console.log("Creating special iterator");
  const it = await client.createSpecialIterator(1, "samples.queue");
  console.log("Done creating special iterator");

  let num = 0;

  console.log(`Sending 6 messages`);
  await sender.sendMessages({ body: "a" });
  await sender.sendMessages({ body: "b" });
  await sender.sendMessages({ body: "c" });
  await sender.sendMessages({ body: "d" });
  await sender.sendMessages({ body: "e" });
  await sender.sendMessages({ body: "f" });
  console.log(`Done sending messages`);

  console.log("start of wait");

  for await (const message of it) {
    console.log(`Got message: ${message}`);
    if (num++ == 5) {
      break;
    }
  }

  console.log("Done");

  await sender.close();
  await client.close();
})();
