# Manifest workflow templates for n8n

These workflows use n8n for the automation and Manifest only for configured model fallback. Each one requires the `n8n-nodes-manifest` community package and a Manifest API credential.

## Draft Gmail replies with Manifest model fallback

**File:** [`draft-gmail-replies-with-model-fallback.json`](./draft-gmail-replies-with-model-fallback.json)

**Creator Hub summary:** Create reply drafts for selected Gmail messages without depending on one AI provider. Label an email, let Manifest retry the configured fallback chain if the primary model fails, and review the generated reply in the original Gmail thread before sending.

**Who this is for:** Support teams, sales teams, founders, and anyone who drafts frequent email replies but wants human review before sending.

**How it works**

1. Gmail Trigger polls unread messages with the `manifest-draft` label.
2. The full sender, subject, and email body are sent to Manifest.
3. Manifest calls the configured primary model and retries fallback models on failure.
4. n8n creates a reply draft in the original Gmail thread.

**Setup**

1. Install `n8n-nodes-manifest` from **Settings > Community Nodes**.
2. Create Gmail and Manifest credentials in n8n.
3. Create a Gmail label named `manifest-draft`.
4. Configure a primary model and at least one fallback model in Manifest.
5. Set the Manifest route response mode to **Buffered** so n8n receives the complete JSON response.
6. Customize the reply policy in the Manifest node's system message.
7. Activate the workflow and apply the label to an unread email.

The workflow never sends email automatically. Review and send the draft from Gmail.

## Qualify inbound leads and alert sales with Manifest fallback

**File:** [`qualify-leads-and-alert-slack-with-fallback.json`](./qualify-leads-and-alert-slack-with-fallback.json)

**Creator Hub summary:** Qualify leads from any website or form, return a structured score to the caller, and alert sales in Slack for high-intent submissions. Manifest retries configured fallback models so a provider outage or rate limit is less likely to drop the AI qualification step.

**Who this is for:** B2B sales and growth teams receiving leads from forms, landing pages, partner APIs, or internal tools.

**How it works**

1. A webhook receives the lead payload.
2. A Code node validates and normalizes required fields.
3. Manifest returns a JSON qualification using the configured primary and fallback models.
4. n8n validates the model output and checks whether the score is at least 70.
5. Qualified leads generate a retried Slack alert; every valid lead receives a structured webhook response even if Slack is unavailable.

**Setup**

1. Install `n8n-nodes-manifest` and create Manifest and Slack credentials.
2. Configure the primary and fallback models in Manifest.
3. Set the Manifest route response mode to **Buffered** so n8n can parse the complete JSON response.
4. Select a Slack channel in **Alert Sales in Slack**.
5. Adjust the scoring prompt and the threshold for your ideal customer profile.
6. Publish the workflow and connect the production webhook URL to your form.

**Test request**

```bash
curl -X POST 'https://YOUR_N8N_HOST/webhook/manifest-lead-qualification' \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","company":"Analytical Engines","role":"CTO","message":"We need a reliable AI gateway for production automations.","source":"website"}'
```
