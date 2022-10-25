/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import StorageUnlock from '$lib/components/storage-unlock.svelte';
import { dialogManager } from '$lib/data/dialog-manager';
import {
  gDriveAuthEndpoint,
  gDriveClientId,
  gDriveScope,
  gDriveTokenEndpoint,
  oneDriveAuthEndpoint,
  oneDriveClientId,
  oneDriveScope,
  oneDriveTokenEndpoint
} from '$lib/data/env';
import { logger } from '$lib/data/logger';
import {
  encrypt,
  isAppDefault,
  type RemoteContext,
  type StorageUnlockAction
} from '$lib/data/storage/storage-source-manager';
import { StorageSourceDefault, StorageKey } from '$lib/data/storage/storage-types';
import { database } from '$lib/data/store';
import { convertAuthErrorResponse } from '$lib/functions/replication/error-handler';
import { isMobile } from '$lib/functions/utils';

interface OAuthTokenData {
  accessToken: string;
  expiration: number;
  scope: string;
  refreshToken?: string;
}

export const storageOAuthTokens = new Map<string, OAuthTokenData>();

export class StorageOAuthManager {
  private storageType: StorageKey;

  private refreshEndpoint;

  private parentWindow: Window | undefined;

  private storageSourceName = '';

  private remoteData: RemoteContext | undefined;

  private authWindow: Window | null = null;

  private codeVerifier = '';

  private authResolver: ((value: OAuthTokenData | PromiseLike<OAuthTokenData>) => void) | undefined;

  private authRejector: ((error: Error) => void) | undefined;

  private rebindedWinHandler: ((event: MessageEvent) => void) | undefined;

  private authCloseIntervalTime = 500;

  private authCloseInterval: NodeJS.Timer | undefined;

  private authTimeout = 30000;

  private authTimeoutTimer: NodeJS.Timeout | undefined;

  constructor(type: StorageKey, refreshEndpoint: string) {
    this.storageType = type;
    this.refreshEndpoint = refreshEndpoint;
  }

  async getToken(
    window: Window,
    storageSourceName: string,
    askForStorageUnlock: boolean
  ): Promise<string | undefined> {
    const oldToken = storageOAuthTokens.get(storageSourceName);
    const shallUnlock = !oldToken || askForStorageUnlock;

    if (!oldToken || this.storageSourceName !== storageSourceName) {
      this.remoteData = undefined;
      this.storageSourceName = storageSourceName;
    }

    let token = await this.verifyToken(oldToken);

    if (token) {
      return token.accessToken;
    }

    this.remoteData = undefined;

    let secret: string | undefined;

    if (storageSourceName === StorageSourceDefault.GDRIVE_DEFAULT) {
      this.remoteData = {
        clientId: gDriveClientId,
        clientSecret: ''
      };
    } else if (storageSourceName === StorageSourceDefault.ONEDRIVE_DEFAULT) {
      this.remoteData = {
        clientId: oneDriveClientId,
        clientSecret: ''
      };
    } else {
      const db = await database.db;
      const storageSource = await db.get('storageSource', storageSourceName);

      if (!storageSource) {
        throw new Error(`No storage source with name ${storageSourceName} found`);
      }

      const result = shallUnlock
        ? await new Promise<StorageUnlockAction | undefined>((resolver) => {
            dialogManager.dialogs$.next([
              {
                component: StorageUnlock,
                props: {
                  description: 'You are trying to access protected data',
                  action: `Enter the correct password for ${storageSourceName} and login to your account if required to proceed`,
                  encryptedData: storageSource.data,
                  forwardSecret: true,
                  resolver
                },
                disableCloseOnClick: true
              }
            ]);
          })
        : undefined;

      if (!result) {
        throw new Error(`Unable to unlock required data`);
      }

      this.remoteData = result;

      token = await this.verifyToken(token);

      if (token) {
        return token.accessToken;
      }

      secret = result.secret;
    }

    this.parentWindow = window;
    this.authWindow = shallUnlock
      ? StorageOAuthManager.createWindow(
          '/auth?ttu-init-auth=1',
          'auth',
          Math.min(Math.max(this.parentWindow.innerWidth, 300), 560),
          Math.min(Math.max(this.parentWindow.innerHeight, 300), 560),
          window
        )
      : null;

    if (!this.authWindow) {
      if (shallUnlock) {
        await new Promise<undefined>((resolver) => {
          dialogManager.dialogs$.next([
            {
              component: StorageUnlock,
              props: {
                description: 'You are trying to access external data',
                action: 'Login to your account when prompted',
                requiresSecret: false,
                encryptedData: undefined,
                resolver
              },
              disableCloseOnClick: true
            }
          ]);
        });

        return this.getToken(window, storageSourceName, false);
      }

      throw new Error('Unable to open login window. Please check your popup settings');
    }

    let errorMessage = '';

    try {
      token = await this.waitForAuth();

      storageOAuthTokens.set(storageSourceName, token);

      if (
        this.parentWindow &&
        this.remoteData.clientId &&
        (this.storageType !== StorageKey.GDRIVE || this.remoteData.clientSecret) &&
        token.refreshToken &&
        token.refreshToken !== this.remoteData.refreshToken &&
        secret
      ) {
        this.remoteData.refreshToken = token.refreshToken;

        try {
          const db = await database.db;

          await db.put('storageSource', {
            name: storageSourceName,
            type: this.storageType,
            data: await encrypt(
              this.parentWindow,
              JSON.stringify({
                clientId: this.remoteData.clientId,
                clientSecret: this.remoteData.clientSecret,
                refreshToken: token.refreshToken
              }),
              secret
            ),
            lastSourceModified: Date.now()
          });
        } catch (err: any) {
          logger.error(`Error updating refresh token for ${storageSourceName}: ${err.message}`);
        }
      }
    } catch (error: any) {
      errorMessage = error.message;
    } finally {
      secret = '';
      this.clearAuthData();
    }

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return token?.accessToken;
  }

  private async verifyToken(token: OAuthTokenData | undefined) {
    if (!token && !this.remoteData) {
      return undefined;
    }

    if (token && token.expiration > Date.now()) {
      return token;
    }

    return this.refreshToken();
  }

  private async refreshToken() {
    if (
      !(
        this.refreshEndpoint &&
        this.storageSourceName &&
        this.remoteData?.clientId &&
        (this.storageType !== StorageKey.GDRIVE || this.remoteData.clientSecret) &&
        this.remoteData.refreshToken
      )
    ) {
      return undefined;
    }

    const form = new FormData();
    form.append('client_id', this.remoteData.clientId);
    form.append('refresh_token', this.remoteData.refreshToken);
    form.append('grant_type', 'refresh_token');

    if (this.storageType === StorageKey.GDRIVE) {
      form.append('client_secret', this.remoteData.clientSecret);
    }

    const response = await fetch(this.refreshEndpoint, { method: 'POST', body: form })
      .then(async (httpResponse) => {
        if (!httpResponse.ok) {
          throw new Error(await convertAuthErrorResponse(httpResponse));
        }

        return httpResponse.json();
      })
      .catch((error) => {
        logger.error(`Unable to refresh token for ${this.storageSourceName}: ${error.message}`);
        return undefined;
      });

    if (!response) {
      this.remoteData.refreshToken = undefined;
      return undefined;
    }

    const { access_token: accessToken, expires_in: expiration, scope } = response;

    if (!accessToken || !expiration || !scope) {
      this.remoteData.refreshToken = undefined;
      logger.error(
        `A required authentication property was not found\nhad token: ${!!accessToken}\nhad expiration: ${!!expiration}\nhad scope: ${!!scope}`
      );
      return undefined;
    }

    const token: OAuthTokenData = {
      accessToken,
      scope,
      expiration: Date.now() + (Number.parseInt(expiration, 10) - 600) * 1000,
      refreshToken: this.remoteData.refreshToken
    };

    storageOAuthTokens.set(this.storageSourceName, token);

    return token;
  }

  private base64Url(buffer: ArrayBuffer) {
    if (!this.parentWindow) {
      throw new Error('Parent window not defined');
    }

    return this.parentWindow
      .btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private waitForAuth(): Promise<OAuthTokenData> {
    return new Promise((resolve, reject) => {
      if (!this.parentWindow) {
        reject(new Error('Parent window not defined'));
        return;
      }

      this.authResolver = resolve;
      this.authRejector = reject;
      this.rebindedWinHandler = this.winHandler.bind(this);
      this.parentWindow.addEventListener('message', this.rebindedWinHandler, false);

      this.authCloseInterval = setInterval(() => {
        if (this.authWindow?.closed) {
          reject(new Error('Window was closed before login'));
        }
      }, this.authCloseIntervalTime);

      this.authTimeoutTimer = setTimeout(() => {
        reject(new Error('Login timeout'));
      }, this.authTimeout);
    });
  }

  private async winHandler(event: MessageEvent) {
    if (
      !this.parentWindow ||
      !this.remoteData ||
      event.source !== this.authWindow ||
      !this.authResolver ||
      !this.authRejector
    ) {
      return;
    }

    switch (event.data.type) {
      case 'getAuthVariables':
        event.ports[0].postMessage({
          result: {
            ...this.remoteData,
            ...StorageOAuthManager.getAuthVariables(this.storageType),
            sendSecret:
              this.storageType === StorageKey.GDRIVE && !isAppDefault(this.storageSourceName)
          }
        });
        break;
      case 'auth':
        this.authResolver(event.data.payload);
        break;
      case 'getCodeChallenge':
        if (!this.codeVerifier) {
          const arr = new Uint8Array(32);

          this.parentWindow.crypto.getRandomValues(arr);
          this.codeVerifier = this.base64Url(arr);
        }

        event.ports[0].postMessage({
          result: this.base64Url(
            await this.parentWindow.crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(this.codeVerifier)
            )
          )
        });
        break;
      case 'getCodeVerifier':
        event.ports[0].postMessage({
          result: this.codeVerifier
        });
        break;
      case 'failure':
        logger.error(event.data.payload.detail);
        this.authRejector(new Error(event.data.payload.message));
        break;

      default:
        break;
    }
  }

  private clearAuthData() {
    clearTimeout(this.authTimeoutTimer as NodeJS.Timeout);
    clearInterval(this.authCloseInterval as NodeJS.Timer);

    if (this.parentWindow && this.rebindedWinHandler) {
      this.parentWindow.removeEventListener('message', this.rebindedWinHandler, false);
    }

    try {
      if (!this.authWindow?.closed) {
        this.authWindow?.close();
      }
    } catch (_) {
      // no-op
    }

    this.authResolver = undefined;
    this.authRejector = undefined;
    this.rebindedWinHandler = undefined;
    this.parentWindow = undefined;
    this.authWindow = null;
    this.codeVerifier = '';
  }

  static createWindow(url: string, title: string, w: number, h: number, window: Window) {
    const onMobile = isMobile(window);
    const screenX = typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft;
    const screenY = typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop;
    const outerWidth =
      typeof window.outerWidth !== 'undefined'
        ? window.outerWidth
        : document.documentElement.clientWidth;
    const outerHeight =
      typeof window.outerHeight !== 'undefined'
        ? window.outerHeight
        : document.documentElement.clientHeight - 22;
    const targetWidth = onMobile ? null : w;
    const targetHeight = onMobile ? null : h;
    const V = screenX < 0 ? window.screen.width + screenX : screenX;
    const left = targetWidth ? parseInt(`${V + (outerWidth - targetWidth) / 2}`, 10) : 0;
    const right = targetHeight
      ? parseInt(`${screenY + (outerHeight - targetHeight) / 2.5}`, 10)
      : 0;
    const features = [];

    if (targetWidth !== null) {
      features.push(`width=${targetWidth}`);
    }

    if (targetHeight !== null) {
      features.push(`height=${targetHeight}`);
    }

    features.push(`left=${left}`);
    features.push(`top=${right}`);
    features.push('scrollbars=1');

    const newWindow = window.open(url, title, features.join(','));

    return newWindow;
  }

  static getAuthVariables(target: StorageKey) {
    switch (target) {
      case StorageKey.GDRIVE:
        return {
          authEndpoint: gDriveAuthEndpoint,
          tokenEndpoint: gDriveTokenEndpoint,
          scope: gDriveScope
        };

      case StorageKey.ONEDRIVE:
        return {
          authEndpoint: oneDriveAuthEndpoint,
          tokenEndpoint: oneDriveTokenEndpoint,
          scope: oneDriveScope
        };

      default:
        return {};
    }
  }

  static revokeToken(revokeEndpoint: string, token: string) {
    const params = new URLSearchParams();

    params.append('token', token);

    fetch(`${revokeEndpoint}?${params.toString()}`, { method: 'POST' }).catch(() => {
      // no-op
    });
  }
}
