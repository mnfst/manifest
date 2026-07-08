# Deploy Manifest on DigitalOcean

This deploys Manifest on DigitalOcean App Platform with a web service and Dev PostgreSQL database. The deploy link uses DigitalOcean's Deploy to DigitalOcean flow, which reads `.do/deploy.template.yaml` from the public repository.

## Prerequisites

- A DigitalOcean account with billing enabled.
- Access to App Platform in the selected region.

This stack creates paid resources, including an App Platform service and Dev PostgreSQL database.

## Deploy

Open the DigitalOcean deploy link:

```text
https://cloud.digitalocean.com/apps/new?repo=https://github.com/mnfst/manifest/tree/main
```

DigitalOcean prompts for the missing secret values before deployment. Generate and paste separate values for:

```bash
openssl rand -hex 32
```

Use one generated value for `BETTER_AUTH_SECRET` and another for `MANIFEST_ENCRYPTION_KEY`.

## Open Manifest

After App Platform finishes deploying, open the app URL and create the first account. The first account becomes the admin.

To verify the deployment, open:

```text
https://<your-app-url>/api/v1/health
```

## Notes

DigitalOcean's deploy button supports public repositories and Dev Databases. For production data, upgrade the Dev Database to a managed database from the DigitalOcean App Platform settings.

The template appends `uselibpqcompat=true` to DigitalOcean's PostgreSQL URL so Node `pg` handles the platform's `sslmode=require` connection string correctly.

Relevant DigitalOcean docs:

- [Deploy to DigitalOcean button](https://docs.digitalocean.com/products/app-platform/how-to/add-deploy-do-button/)
- [App Platform app spec](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Bindable environment variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/#using-bindable-variables-within-environment-variables)
