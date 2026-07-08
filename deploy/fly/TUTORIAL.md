# Deploy Manifest on Fly.io

This guide deploys Manifest on Fly.io with the public Manifest Docker image and a Fly Postgres database.

Fly is a CLI-first deployment target, not a browser one-click button. The script in this directory creates the app, creates Postgres, attaches `DATABASE_URL`, generates Manifest secrets, and deploys the Docker image.

## Prerequisites

- A Fly.io account with billing enabled.
- `flyctl` installed and authenticated with `fly auth login`.
- Permission to create Fly apps and Postgres apps.

This stack creates paid resources. Review Fly pricing before leaving test apps running.

## Fast Deploy

From the Manifest repository root:

```bash
FLY_APP_NAME=manifest-demo \
FLY_REGION=cdg \
FLY_ORG=personal \
./deploy/fly/deploy.sh
```

Environment variables:

- `FLY_APP_NAME`: Fly app name. Defaults to a generated `manifest-<hex>` name.
- `FLY_POSTGRES_APP_NAME`: Postgres app name. Defaults to `<app-name>-db`.
- `FLY_REGION`: Fly region. Defaults to `cdg`.
- `FLY_ORG`: Fly organization. Defaults to `personal`.

The script uses [`fly.toml`](fly.toml) as a template and deploys `docker.io/manifestdotbuild/manifest:6`.

## Manual Deploy

Create the app and database:

```bash
APP_NAME=manifest-demo
POSTGRES_APP_NAME=${APP_NAME}-db
REGION=cdg
ORG=personal

fly apps create "$APP_NAME" --org "$ORG" -y

fly postgres create \
  --name "$POSTGRES_APP_NAME" \
  --org "$ORG" \
  --region "$REGION" \
  --initial-cluster-size 1 \
  --vm-cpu-kind shared \
  --vm-cpus 1 \
  --vm-memory 512 \
  --volume-size 1

fly postgres attach "$POSTGRES_APP_NAME" \
  --app "$APP_NAME" \
  --database-name manifest \
  --database-user manifest \
  --yes
```

Set secrets:

```bash
fly secrets set \
  --app "$APP_NAME" \
  --stage \
  "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" \
  "MANIFEST_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

Copy `deploy/fly/fly.toml` to a temporary file, replace `manifest-example` with your app name, then deploy:

```bash
cp deploy/fly/fly.toml fly.toml
perl -pi -e "s/manifest-example/$APP_NAME/g; s/primary_region = \"cdg\"/primary_region = \"$REGION\"/" fly.toml
fly deploy --app "$APP_NAME" --config fly.toml
```

## Open Manifest

Open the deployed app and create the first admin account:

```text
https://<your-fly-app>.fly.dev
```

Verify the deployment:

```bash
curl -fsS https://<your-fly-app>.fly.dev/api/v1/health
```

View logs:

```bash
fly logs --app <your-fly-app>
```

## What Gets Provisioned

- Fly app running `docker.io/manifestdotbuild/manifest:6`.
- Fly Postgres app.
- `DATABASE_URL` secret from `fly postgres attach`.
- Generated `BETTER_AUTH_SECRET` and `MANIFEST_ENCRYPTION_KEY` secrets.
- HTTPS Fly domain at `https://<app>.fly.dev`.

## Production notes

- The template keeps one Machine running with `min_machines_running = 1` so Manifest is always available for agents.
- For production, choose a larger Postgres configuration or Fly Managed Postgres instead of the small script default.
- Add a custom domain before configuring OAuth callback URLs.
- Destroy both the app and database when testing is done:

```bash
fly apps destroy <your-fly-app>
fly apps destroy <your-fly-postgres-app>
```

Relevant Fly docs:

- [Fly app configuration](https://fly.io/docs/reference/configuration/)
- [Deploy an existing Docker image](https://fly.io/docs/reference/configuration/#specify-a-docker-image)
- [Create Postgres](https://fly.io/docs/python/do-more/add-postgres/)
- [Attach Postgres](https://fly.io/docs/postgres/managing/attach-detach/)
