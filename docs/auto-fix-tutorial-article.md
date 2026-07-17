# Auto-fix: your failing requests now repair themselves

> **Draft for the manifest.build blog.** Video slots are marked
> `[VIDEO n]` with a 30-60 second recording script under each one.
> Replace the slots with the recorded clips before publishing.

---

Your agent sends a request. The provider rejects it. Not because your
prompt was bad, but because someone renamed a parameter last Tuesday, or
retired the model you pinned three months ago, or decided your
`max_tokens` value is now out of range.

Until today, that rejection was your problem. You read the error, you
patched your code, you redeployed. Meanwhile your agent sat there with a
4xx instead of an answer.

Auto-fix changes that. When a provider rejects a request with a fixable
error, Manifest repairs the request and sends it again. Your agent gets
its answer. You get the whole story in your dashboard: the failure, the
fix, the retry.

It shipped today. If your workspace has been granted access and Auto-fix is
enabled for a harness, eligible provider errors can be repaired automatically.
The deployment must also have a configured Auto-fix service.

## Watch it happen

`[VIDEO 1: a broken request repairs itself]`

> **Script (45s).** Start on a terminal. Send a chat completion through
> Manifest with a parameter the provider no longer accepts, for example
> `max_output_tokens` on a model that wants `max_completion_tokens`.
> Show the agent receiving a normal answer anyway. Switch to the
> Manifest dashboard, open the request in the Requests log. Point at the
> two attempts: the original one in red with the provider error, the
> auto-fix attempt in green. Say: "The provider rejected this call. I
> did nothing. Manifest renamed the parameter and retried. My agent
> never noticed."

What you just saw is one request and two attempts. The first attempt is
the original call, and it failed. The second attempt carries the repair,
and it succeeded. The request as a whole came back green. In the
dashboard this reads as **Recovered by Auto-fix**.

That distinction matters. An auto-fix names the method that produced an
attempt, not a guarantee of success. Sometimes the repaired call fails
too, and you see that attempt in red with its own error. Manifest never
hides a failure behind a badge.

## What kinds of errors it fixes

Auto-fix targets request-side rejections: the 4xx family where the
provider is telling you, in its error message, exactly what it wants
instead. Some examples from real traffic:

| The provider says                         | Auto-fix does                                   |
| ----------------------------------------- | ----------------------------------------------- |
| `Unknown parameter: max_output_tokens`    | Renames it to the name this model actually uses |
| `Range of max_tokens should be [1, 8192]` | Clamps the value into the stated range          |
| `property 'thinking' is unsupported`      | Drops the parameter                             |
| `Model gpt-4-32k has been deprecated`     | Swaps in the documented successor               |
| `extra_forbidden: cache_control`          | Strips the field from your messages             |

Every fix is deterministic. Auto-fix does not ask a model to guess what
your request meant. It applies a known, tested correction for a known
error, the same way every time.

## Where you see it

`[VIDEO 2: the Overview]`

> **Script (30s).** Open the Overview page. Point at the Recovered
> requests number. Say: "This is how many requests came back with an
> answer only because Manifest repaired them. Without Auto-fix, each one
> of these was an error in my agent's lap." Hover the chart to show
> recovered requests accumulating over the week.

The Overview counts **Recovered requests**: requests that failed on the
first attempt and still ended green, either because Auto-fix repaired
the call or because a fallback retried it on another model. Each
recovered request is an error your code never had to handle.

`[VIDEO 3: the attempt diff]`

> **Script (40s).** Open a recovered request in the drawer. Expand the
> auto-fix attempt. Show the applied fix: the parameter that was
> renamed, old name and new name. Say: "Manifest shows me exactly what
> it changed. If I want to stop seeing this fix, I update my code with
> the new parameter name. Auto-fix buys me the time to do that on my
> schedule instead of the provider's."

Nothing is silent. Every repaired attempt records what changed, so you
can update your code when it suits you. Auto-fix is a safety net, not a
rug.

## It gets better on its own

Auto-fix learns from real traffic across all accounts. When a provider
starts rejecting a parameter nobody had seen rejected before, that error
gets fingerprinted, a fix gets built and verified, and from then on
every account recovers from it. The share of failures Auto-fix can
repair grows week after week, and you do nothing for that to happen.

## Try it

If you joined the Auto-fix waitlist, it is already live on your account.
Open your dashboard and look at your Requests log: you may find repairs
that already happened.

Not on the waitlist? You can [request a demo](https://manifest.build)
and we will walk you through it on your own traffic, or wait for the
public release, coming to every account soon.
