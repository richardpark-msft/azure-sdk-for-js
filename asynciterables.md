# Service Bus - async iterator all the things

## Proposal

Replace `subscribe` with `getMessageIterator`

## What?

No, really.

## Why?

ServiceBus receivers offer 3 different ways to receive messages. The iterator and `subscribe` serve the same purpose (infinite iteration of messages).

Although we have focused on `subscribe` primarily (in samples and snippets) it makes sense to focus on the iterator for a few reasons:

- It mirrors a natural programming pattern of iterating over a collection of objects that every programmer is already used to.
- It eliminates some of the [message to error](#message-to-error-correlation) correlation that we've noticed in the `subscribe`or `Processor` models in other languages.
- It flows nicely with JavaScript libraries with cool names like ixjs.
- AsyncIterators are going to be part of core JavaScript. (maybe)

## How?

We have some work to get `getMessageIterator()` to be production-ready. Some of it is actual work and some of it is [questions that will lead to work](#questions-to-answer). And some of it is work that will lead to work.

### Known work

- abortSignal support (`receiveBatch` and `subscribe` have this today)
- auto-lock renewal (`subscribe` does)
- Timeouts.
  - Python, for instance, has `idle_timeout`, allowing the iterator to close if no messages are received within that window of time.

### Questions to answer

#### Closing

There is a resource associated with an iterator (Receiver). How does the user close it? Is there a method on the iterable that is returned (would people even look for it there?).

#### Errors

- How do we deliver non-fatal errors like receiver restarts?
- How do we deliver _fatal_ errors?

Java, via reactor, delivers these two separate ways:

- Their payload for their iterator is a tuple, with an error and a message. If the 'error' is set then the 'message' is null.
- Fatal errors (ie, terminal errors) are delivered via a callback they passed when they subscribed to the collection.

We have destructuring. It wouldn't be awful but it'd be nice to come up with an alternative.

#### Timeouts

- What values should users be able to set?
  - retries still make sense in this world (connection failures, etc..)
  - Should we just "retry" infinitely? This was a feature under discussion for `subscribe` where the users shouldn't need to concern themselves with restarting their subscriber. (this mirrors the behavior of the .NET ServiceBusProcessor).
  - Python has a concept of `idle_timeout` where, if messages aren't received within a certain time, it aborts. Do we want the same?

#### Performance

- Our current iterator implementation initiates and receives a single message at a time. There is _probably_ a perf hit by doing this versus the current `subscribe` model which can add more credits at a time (depending on your `maxConcurrentCalls` setting). I need to do some simple benchmarking to see the effect.

## Footnotes

#### Message to error correlation

Let's assume a user has a subscribe() call setup like this:

```typescript
subscribe(
  {
    processMessage: async (msg) => {
      // automatically calls msg.complete() after
      // the callback exits.
    },
    processError: async (err) => {
      // receives errors, without any context
    },
  },
  {
    autoComplete: true,
  }
);
```

Now use the power of your imagination and picture this sequence of events:

1. `processMessage` is called and the user handles the message by pushing it to a database in a transaction.
2. `processMessage` finishes without error and the user assumes (rightfully so) that we will now properly complete() their message.
3. "Something" causes us to fail to properly complete the message (perhaps we failed to renew a message lock, perhaps there was a network hiccup).
4. We call `processError` with the failure and walk away.

The user has the annoying job here of tracking the result of `processMessage` _and_ the result of potential `processError` calls to know if they can truly consider a message as processed.

We also don't currently have a way for them to correlate "this message led to this error", making it even more annoying.
