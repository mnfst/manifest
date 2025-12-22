# Manifest Starter

## Development

```bash
npm run dev
```

## Exposing with ngrok

To test widgets in ChatGPT, you need to expose your local server via ngrok:

```bash
ngrok http 3000
```

The Vite config already allows `.ngrok-free.dev` and `.ngrok.io` hosts in `server.allowedHosts`.

Update `baseUrl` in `vite.config.ts` with your ngrok URL:

```ts
chatGPTWidgetPlugin({
  widgetsDir: 'src/web',
  baseUrl: 'https://your-subdomain.ngrok-free.dev'
})
```
