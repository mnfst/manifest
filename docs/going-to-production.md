# Going to production

CASE is made to be quickly deployed to production.

You should clone your repository on your server using **GIT** and run as a deploy script:

```bash
npm install
npm run build
```

Make sure to create a `.env` file at root level:

```.env
PORT=1111
TOKEN_SECRET_KEY=your_secret_key
NODE_ENV=production
```

And then launch the following task with a task manager like [pm2](https://pm2.keymetrics.io/) or [systemd](https://systemd.io/):

```
npm run start:prod
```

## NGINX Config

This in an example config if you are using **NGINX** and serving the app on the port **4000**:

```nginx
    location / {
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-NginX-Proxy true;
        proxy_pass http://localhost:4000/;
        proxy_ssl_session_reuse off;
        proxy_set_header Host $http_host;
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;

        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }

```
