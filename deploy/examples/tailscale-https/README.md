# HTTPS with a Tailscale certificate

For a server on a tailnet: nginx in the `web` container serves
`https://<machine>.<tailnet>.ts.net` with a Let's Encrypt certificate from
`tailscale cert`, plain HTTP on the LAN address, and redirects HTTP requests for
the `.ts.net` name to HTTPS. (The simpler alternative is `tailscale serve`, see
[INSTALL.md](../../../docs/INSTALL.md#https).)

Needs Tailscale on the server with HTTPS certificates enabled for the tailnet,
and the layout of `scripts/deploy.sh` (`/etc/ebook-reader`, `ebook-compose`).

1. Certificate and renewal (as root):

   ```sh
   install -d -m 700 /etc/ssl/tailscale
   install -m 755 tailscale-cert-renew.sh /usr/local/sbin/tailscale-cert-renew
   install -m 644 tailscale-cert.service tailscale-cert.timer /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now tailscale-cert.timer
   systemctl start tailscale-cert.service   # first certificate
   ```

2. nginx and Compose:

   ```sh
   install -m 644 nginx-tls.conf /etc/ebook-reader/nginx-tls.conf
   install -m 644 docker-compose.override.yml /etc/ebook-reader/docker-compose.override.yml
   ```

   With `scripts/deploy.sh`, put the override in your `local/` folder instead; it
   copies it on every deploy.

3. In the env file: `PUBLIC_HTTPS_URL=https://<machine>.<tailnet>.ts.net` (the
   plain-HTTP page links there to sign in) and `TRUSTED_NETWORKS` with your LAN
   and `100.64.0.0/10` if signed-out tailnet readers should have access. Then
   deploy (or `ebook-compose up -d --build`).

The renewal timer reloads nginx in the container after each renewal.
