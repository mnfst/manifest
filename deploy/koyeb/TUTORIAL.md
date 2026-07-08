# Deploy Manifest on Koyeb

This walkthrough deploys the public Manifest Docker image to a Koyeb Web Service. The deploy button pre-fills the image, HTTP port, and runtime settings, but you must create PostgreSQL separately and replace the placeholder secrets before deploying.

## Prerequisites

- A Koyeb account.
- A Koyeb PostgreSQL Database Service.
- Two random 32+ character secrets for Manifest.

This deployment creates paid resources if your selected Koyeb service or database plan is not free.

## Create PostgreSQL

In Koyeb, create a PostgreSQL Database Service in the same region you plan to use for Manifest. After it is ready, open the database connection details and copy the connection string.

Manifest uses TLS to connect to Koyeb Postgres, so include `sslmode=require` in the connection string. If the copied URL has no query string, append `?sslmode=require`. If it already has query parameters, append `&sslmode=require`.

## Generate secrets

Generate separate values for session signing and at-rest provider credential encryption:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

## Deploy Manifest

Open the Koyeb deploy link:

```text
https://app.koyeb.com/deploy?type=docker&image=docker.io%2Fmanifestdotbuild%2Fmanifest%3A6&name=manifest&service_type=web&ports=2099%3Bhttp%3B%2F&env%5BDATABASE_URL%5D=postgres%3A%2F%2FUSER%3APASSWORD%40HOST%2FDB%3Fsslmode%3Drequire&env%5BBETTER_AUTH_SECRET%5D=replace-with-openssl-rand-hex-32&env%5BMANIFEST_ENCRYPTION_KEY%5D=replace-with-different-openssl-rand-hex-32&env%5BBETTER_AUTH_URL%5D=https%3A%2F%2F%7B%7B+KOYEB_PUBLIC_DOMAIN+%7D%7D&env%5BMANIFEST_MODE%5D=selfhosted&env%5BDB_POOL_MAX%5D=8&env%5BAUTH_DB_POOL_MAX%5D=4
```

In the deploy form:

- Replace `DATABASE_URL` with your Koyeb Postgres connection string.
- Replace `BETTER_AUTH_SECRET` with the first generated secret.
- Replace `MANIFEST_ENCRYPTION_KEY` with the second generated secret.
- Leave `BETTER_AUTH_URL` as `https://{{ KOYEB_PUBLIC_DOMAIN }}`.
- Leave `MANIFEST_MODE`, `DB_POOL_MAX`, and `AUTH_DB_POOL_MAX` unchanged for a single-instance deploy.

The button deploys `docker.io/manifestdotbuild/manifest:6` and exposes port `2099` over HTTP.

## Open Manifest

After the deployment is live, open the public Koyeb domain and create the first account. The first account becomes the admin.

To verify the deployment:

```bash
curl -sSf https://<your-koyeb-domain>/api/v1/health
```

## Tearing it down

Delete both resources when you are done:

- The Manifest Koyeb Web Service.
- The Koyeb PostgreSQL Database Service.

Deleting only the web service leaves the database running.
