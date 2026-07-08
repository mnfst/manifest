# Deploy Manifest on Heroku

This template deploys Manifest to a Heroku Cedar container-stack app with one web dyno and a Heroku Postgres Essential-0 database.

## Deploy

Open the Heroku deploy link and choose an app name:

```text
https://www.heroku.com/deploy?template=https://github.com/mnfst/manifest
```

When Heroku asks for `BETTER_AUTH_URL`, enter the public URL for the app name you chose:

```text
https://<your-app-name>.herokuapp.com
```

Heroku generates the session and encryption secrets, provisions Postgres as `DATABASE_URL`, builds `Dockerfile.heroku`, and starts the web dyno.

## What Gets Provisioned

- Heroku app on the `container` stack
- One `basic` web dyno
- Heroku Postgres `essential-0`
- Runtime config for Manifest self-hosting, Postgres TLS, and conservative connection pools

## After Deploy

Open the deployed app and create the first admin account. Fresh installs redirect to `/setup`; the first account you create becomes the admin.

Check health:

```bash
curl -fsS https://<your-app-name>.herokuapp.com/api/v1/health
```

View logs:

```bash
heroku logs --tail -a <your-app-name>
```

## Notes

- Heroku sets `PORT` automatically, so the template does not pin a port.
- `PGSSLMODE=no-verify` enables TLS for Heroku Postgres without editing the managed `DATABASE_URL`.
- `DB_POOL_MAX=8` and `AUTH_DB_POOL_MAX=4` leave headroom under the Essential-0 connection limit. Increase them only after moving to a larger Postgres plan.
- Heroku no longer has free dynos or free Postgres. Destroy the app when testing is done to stop billing:

```bash
heroku apps:destroy -a <your-app-name>
```
