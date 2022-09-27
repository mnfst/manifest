# Monitoring (Bugsnag)

Your CASE app probably needs some monitoring or logging tool. As of today, CASE is only compatible with [Bugsnag](https://www.bugsnag.com/).

## Creating a Bugsnag project

First of all, you need to create a Bugsnag account (free or paying based on your requirements). Once done, create a new project with the name of your app (type: "browser" and "other"). This project will receive error notification from both client and server parts, as CASE is a monorepo. You are free to create 2 distinct projects if you want to, but for a basic and middle-sized app, having everything grouped will make it clearer.

## Implementing in the client (Angular)

Set `enableBugsnag` to `true` and add your project "Notifier API key" in the following property. You may want to enable it only for defined environments like production or staging.

```js
// client/src/environment/environment.ts
{
  [...]
  enableBugsnag: false,
  bugsnagApiKey: 'Insert API Key Here'
}
```

## Implementing in the server (NestJS)

In your `.env` file, set `ENABLE_BUGSNAG` to `true` and add your Bugsnag API key in the `BUGSNAG_API_KEY` property.

You can also pass a stage (development, production, custom...) in the `BUGSNAG_RELEASE_STAGE` setting. [Click here to read more about Bugsnag release stages](https://docs.bugsnag.com/product/releases/).

With that on, every error triggered should be reported in your Bugsnag dashboard.
