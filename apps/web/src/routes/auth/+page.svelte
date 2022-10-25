<script lang="ts">
  import { browser } from '$app/environment';
  import { faSpinner } from '@fortawesome/free-solid-svg-icons';
  import { convertAuthErrorResponse } from '$lib/functions/replication/error-handler';
  import Fa from 'svelte-fa';

  $: if (browser) {
    handleAuthRequest();
  }

  async function handleAuthRequest() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const hashError = hashParams.has('error_description') || hashParams.has('error');
    const redirectUri = `${url.origin}${url.pathname}`;

    if (hashError) {
      reportError(
        url.origin,
        'Authorization failed',
        hashParams.get('error_description') || hashParams.get('error') || 'Unknown error'
      );
    } else if (url.searchParams.has('code')) {
      const params = new URLSearchParams();
      const { clientId, clientSecret, sendSecret, tokenEndpoint } = await getDataFromOpener(
        url.origin,
        {
          type: 'getAuthVariables'
        }
      );

      params.append('grant_type', 'authorization_code');
      params.append('redirect_uri', redirectUri);
      params.append('client_id', clientId);

      if (sendSecret && clientSecret) {
        params.append('client_secret', clientSecret);
      }

      params.append('code', url.searchParams.get('code') || '');
      params.append(
        'code_verifier',
        await getDataFromOpener(url.origin, { type: 'getCodeVerifier' })
      );

      fetch(tokenEndpoint, {
        method: 'POST',
        body: params.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(await convertAuthErrorResponse(response));
          }

          return response.json();
        })
        .then((tokenData) => {
          checkAuthResponse(
            url.origin,
            tokenData.access_token,
            tokenData.expires_in,
            tokenData.scope,
            true,
            tokenData.refresh_token
          );
        })
        .catch((error) => {
          reportError(url.origin, 'Code authorization request failed', error.message);
        });
    } else if (hashParams.has('access_token')) {
      checkAuthResponse(
        url.origin,
        hashParams.get('access_token'),
        hashParams.get('expires_in'),
        hashParams.get('scope'),
        false
      );
    } else if (url.searchParams.has('ttu-init-auth')) {
      const params = new URLSearchParams();

      const { clientId, clientSecret, authEndpoint, tokenEndpoint, scope } =
        await getDataFromOpener(url.origin, { type: 'getAuthVariables' });

      if (!clientId || !scope || !authEndpoint) {
        return reportError(
          url.origin,
          'A required authentication input was not found',
          `ClientId: ${!!clientId}\nScope: ${!!scope}\nAuthEndpoint: ${!!authEndpoint}`
        );
      }

      params.append('client_id', clientId);
      params.append('redirect_uri', redirectUri);
      params.append('scope', scope);

      if (clientSecret && tokenEndpoint) {
        params.append('response_type', 'code');
        params.append('access_type', 'offline');
        params.append('code_challenge_method', 'S256');
        params.append(
          'code_challenge',
          await getDataFromOpener(url.origin, { type: 'getCodeChallenge' })
        );
        params.append('prompt', 'consent');
      } else {
        params.append('response_type', 'token');
      }

      window.location.assign(`${authEndpoint}?${params.toString()}`);
    } else {
      reportError(
        url.origin,
        'Unexpected authentication context',
        `Url: ${url.href}\nHash: ${url.hash || '-'}`
      );
    }

    return undefined;
  }

  function reportError(origin: string, baseError: string, detail: string) {
    if (!window.opener) {
      return;
    }

    window.opener.postMessage(
      {
        type: 'failure',
        payload: {
          message: baseError,
          detail: `${baseError}\n${detail}`
        }
      },
      origin
    );
  }

  function checkAuthResponse(
    origin: string,
    accessToken: string | null,
    expiration: string | null,
    scope: string | null,
    withRefreshToken = false,
    refreshToken?: string | null
  ) {
    if (!window.opener) {
      return;
    }

    if (!accessToken || !expiration || !scope || (withRefreshToken && !refreshToken)) {
      reportError(
        origin,
        'A required authentication property was not found',
        `Had Token: ${!!accessToken}\nHad Expiration: ${!!expiration}\nHad Scope"${!!scope}${
          withRefreshToken ? `\nHad Refresh Token"${!!refreshToken}` : ''
        }`
      );
      return;
    }

    window.opener.postMessage(
      {
        type: 'auth',
        payload: {
          accessToken,
          scope,
          expiration: Date.now() + (Number.parseInt(expiration, 10) - 600) * 1000,
          refreshToken
        }
      },
      origin
    );
  }

  function getDataFromOpener(origin: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.opener) {
        return;
      }

      const channel = new MessageChannel();

      channel.port1.onmessage = ({ data }) => {
        channel.port1.close();

        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.result);
        }
      };

      window.opener.postMessage(payload, origin, [channel.port2]);
    });
  }
</script>

<div class="fixed inset-0 flex h-full w-full items-center justify-center text-7xl">
  <Fa icon={faSpinner} spin />
</div>
