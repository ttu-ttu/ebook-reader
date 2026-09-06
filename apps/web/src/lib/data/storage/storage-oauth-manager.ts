/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
import MessageDialog from '$lib/components/message-dialog.svelte';
import StorageUnlock from '$lib/components/storage-unlock.svelte';
import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
import { dialogManager } from '$lib/data/dialog-manager';
import {
  gDriveAuthEndpoint,
  gDriveClientId,
  gDriveRefreshEndpoint,
  gDriveRevokeEndpoint,
  gDriveScope,
  gDriveTokenEndpoint,
  oneDriveAuthEndpoint,
  oneDriveClientId,
  oneDriveScope,
  oneDriveTokenEndpoint,
  pagePath
} from '$lib/data/env';
import { logger } from '$lib/data/logger';
import {
  encrypt,
  isAppDefault,
  isRemoteContext,
  unlockStorageData,
  type RemoteContext,
  type StorageUnlockAction
} from '$lib/data/storage/storage-source-manager';
import { StorageSourceDefault, StorageKey } from '$lib/data/storage/storage-types';
import { database } from '$lib/data/store';
import { convertAuthErrorResponse } from '$lib/functions/replication/error-handler';
import { writableSubject } from '$lib/functions/svelte/store';
import { isMobile } from '$lib/functions/utils';

export enum StorageConnectionState {
  CONNECTED = 'connected',
  NEEDS_RECONNECT = 'needs_reconnect',
  DISCONNECTED = 'disconnected'
}

export const storageConnectionStates$ = writableSubject<Record<string, StorageConnectionState>>({});

export function setConnectionState(storageSourceName: string, state: StorageConnectionState) {
  const current = storageConnectionStates$.getValue();
  if (current[storageSourceName] !== state) {
    storageConnectionStates$.next({
      ...current,
      [storageSourceName]: state
    });
  }
}

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

  private authCloseInterval: number | undefined;

  private authTimeout = 45000;

  private authTimeoutTimer: number | undefined;

  constructor(type: StorageKey, refreshEndpoint: string) {
    this.storageType = type;
    this.refreshEndpoint = refreshEndpoint;
  }

  async getToken(
    window: Window,
    storageSourceName: string,
    askForStorageUnlock: boolean,
    authWindow?: Window | null,
    oldUnlockResult?: StorageUnlockAction,
    oldStorageSource?: BooksDbStorageSource | undefined
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
    let unlockResult = oldUnlockResult;
    let storageSource = oldStorageSource;

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
      if (!unlockResult) {
        const db = await database.db;

        storageSource = await db.get('storageSource', storageSourceName);

        if (!storageSource) {
          throw new Error(`No storage source with name ${storageSourceName} found`);
        }

        unlockResult = await unlockStorageData(
          storageSource,
          'You are trying to access protected data',
          shallUnlock
            ? {
                action: `Enter the correct password for ${storageSourceName} and login to your account if required to proceed`,
                encryptedData: storageSource.data,
                forwardSecret: true
              }
            : undefined
        );

        if (!unlockResult) {
          throw new Error(`Unable to unlock required data`);
        }
      }

      this.remoteData = {
        clientId: unlockResult.clientId,
        clientSecret: unlockResult.clientSecret,
        refreshToken: unlockResult.refreshToken,
        accountEmail: unlockResult.accountEmail,
        accountName: unlockResult.accountName
      };

      token = await this.verifyToken(token);

      if (token) {
        return token.accessToken;
      }

      secret = unlockResult.secret;
    }

    this.parentWindow = window;

    if (authWindow) {
      this.authWindow = authWindow;
      this.authWindow.location.assign(`${pagePath}/auth?ttu-init-auth=1`);
    } else if (shallUnlock) {
      this.authWindow = StorageOAuthManager.createWindow(
        `${pagePath}/auth?ttu-init-auth=1`,
        'auth',
        Math.min(Math.max(this.parentWindow.innerWidth, 300), 560),
        Math.min(Math.max(this.parentWindow.innerHeight, 300), 560),
        window
      );
    } else {
      this.authWindow = null;
    }

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

        return this.getToken(
          window,
          storageSourceName,
          false,
          StorageOAuthManager.createWindow(
            `${pagePath}/auth?ttu-init-wait=1`,
            'auth',
            Math.min(Math.max(this.parentWindow.innerWidth, 300), 560),
            Math.min(Math.max(this.parentWindow.innerHeight, 300), 560),
            window
          ),
          unlockResult,
          storageSource
        );
      }

      throw new Error('Unable to open login window. Please check your popup settings');
    }

    let errorMessage = '';

    try {
      const existingStorageSourceData = storageSource || {
        storedInManager: false,
        encryptionDisabled: false
      };

      token = await this.waitForAuth(window);

      storageOAuthTokens.set(storageSourceName, token);
      setConnectionState(storageSourceName, StorageConnectionState.CONNECTED);

      if (this.remoteData && !this.remoteData.accountEmail && token.accessToken) {
        const account =
          this.storageType === StorageKey.GDRIVE
            ? await StorageOAuthManager.fetchGoogleAccount(token.accessToken)
            : await StorageOAuthManager.fetchOneDriveAccount(token.accessToken);
        if (account.email) {
          this.remoteData.accountEmail = account.email;
          this.remoteData.accountName = account.name;
        }
      }

      if (
        this.parentWindow &&
        this.remoteData.clientId &&
        (this.storageType !== StorageKey.GDRIVE || this.remoteData.clientSecret) &&
        token.refreshToken &&
        token.refreshToken !== this.remoteData.refreshToken &&
        (secret || existingStorageSourceData.encryptionDisabled)
      ) {
        this.remoteData.refreshToken = token.refreshToken;

        try {
          const db = await database.db;
          const contextToStore: RemoteContext = {
            clientId: this.remoteData.clientId,
            clientSecret: this.remoteData.clientSecret,
            refreshToken: token.refreshToken,
            accountEmail: this.remoteData.accountEmail,
            accountName: this.remoteData.accountName
          };
          const newData = existingStorageSourceData.encryptionDisabled
            ? contextToStore
            : await encrypt(this.parentWindow, JSON.stringify(contextToStore), secret!);

          await db.put('storageSource', {
            ...existingStorageSourceData,
            name: storageSourceName,
            type: this.storageType,
            data: newData,
            disconnected: false,
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
      setConnectionState(this.storageSourceName, StorageConnectionState.CONNECTED);
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
      setConnectionState(this.storageSourceName, StorageConnectionState.NEEDS_RECONNECT);
      this.remoteData.refreshToken = undefined;
      return undefined;
    }

    const { access_token: accessToken, expires_in: expiration, scope } = response;

    if (!accessToken || !expiration || !scope) {
      setConnectionState(this.storageSourceName, StorageConnectionState.NEEDS_RECONNECT);
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
    setConnectionState(this.storageSourceName, StorageConnectionState.CONNECTED);

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

  private waitForAuth(window: Window): Promise<OAuthTokenData> {
    return new Promise((resolve, reject) => {
      if (!this.parentWindow) {
        reject(new Error('Parent window not defined'));
        return;
      }

      this.authResolver = resolve;
      this.authRejector = reject;
      this.rebindedWinHandler = this.winHandler.bind(this);
      this.parentWindow.addEventListener('message', this.rebindedWinHandler, false);

      this.authCloseInterval = window.setInterval(() => {
        if (this.authWindow?.closed) {
          reject(new Error('Window was closed before login'));
        }
      }, this.authCloseIntervalTime);

      this.authTimeoutTimer = window.setTimeout(() => {
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
    clearTimeout(this.authTimeoutTimer);
    clearInterval(this.authCloseInterval);

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

  static async fetchGoogleAccount(accessToken: string): Promise<{ email?: string; name?: string }> {
    try {
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      if (res.ok) {
        const json = await res.json();
        return {
          email: json.user?.emailAddress,
          name: json.user?.displayName
        };
      }
    } catch (err: any) {
      logger.warn(`Failed to fetch Google Drive account info: ${err.message}`);
    }
    return {};
  }

  static async fetchOneDriveAccount(
    accessToken: string
  ): Promise<{ email?: string; name?: string }> {
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        return {
          email: json.userPrincipalName || json.mail,
          name: json.displayName
        };
      }
    } catch (err: any) {
      logger.warn(`Failed to fetch OneDrive account info: ${err.message}`);
    }
    return {};
  }

  static async reconnect(window: Window, storageSourceName: string): Promise<boolean> {
    const isDefault = isAppDefault(storageSourceName);
    let storageSourceType = StorageKey.GDRIVE;
    let refreshEndpoint = gDriveRefreshEndpoint;
    let storageSource: BooksDbStorageSource | undefined;
    let unlockResult: StorageUnlockAction | undefined;

    if (isDefault) {
      if (storageSourceName === StorageSourceDefault.ONEDRIVE_DEFAULT) {
        storageSourceType = StorageKey.ONEDRIVE;
        refreshEndpoint = oneDriveTokenEndpoint;
      }
    } else {
      const db = await database.db;
      storageSource = await db.get('storageSource', storageSourceName);

      if (!storageSource) {
        logger.error(`Storage source ${storageSourceName} not found for reconnect`);
        return false;
      }

      if (storageSource.type !== StorageKey.GDRIVE && storageSource.type !== StorageKey.ONEDRIVE) {
        logger.error(`Cannot reconnect non-cloud storage source ${storageSourceName}`);
        return false;
      }

      storageSourceType = storageSource.type;
      refreshEndpoint =
        storageSource.type === StorageKey.GDRIVE ? gDriveRefreshEndpoint : oneDriveTokenEndpoint;

      unlockResult = await unlockStorageData(
        storageSource,
        'You are trying to reconnect cloud storage',
        {
          action: `Enter the password for ${storageSourceName} to reconnect`,
          encryptedData: storageSource.data,
          forwardSecret: true
        }
      );

      if (!unlockResult) {
        return false;
      }
    }

    const authWindow = StorageOAuthManager.createWindow(
      `${pagePath}/auth?ttu-init-auth=1`,
      'auth',
      Math.min(Math.max(window.innerWidth, 300), 560),
      Math.min(Math.max(window.innerHeight, 300), 560),
      window
    );

    if (!authWindow) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Popup Blocked',
            message: 'Unable to open login window. Please check your browser popup settings.'
          },
          disableCloseOnClick: true
        }
      ]);
      return false;
    }

    const manager = new StorageOAuthManager(storageSourceType, refreshEndpoint);

    try {
      const accessToken = await manager.getToken(
        window,
        storageSourceName,
        false,
        authWindow,
        unlockResult,
        storageSource
      );

      if (!accessToken) {
        return false;
      }

      const accountInfo =
        storageSourceType === StorageKey.GDRIVE
          ? await StorageOAuthManager.fetchGoogleAccount(accessToken)
          : await StorageOAuthManager.fetchOneDriveAccount(accessToken);

      const previousEmail = unlockResult?.accountEmail;
      if (
        previousEmail &&
        accountInfo.email &&
        previousEmail.trim().toLowerCase() !== accountInfo.email.trim().toLowerCase()
      ) {
        const wasCanceled = await new Promise<boolean>((resolve) => {
          dialogManager.dialogs$.next([
            {
              component: ConfirmDialog,
              props: {
                dialogHeader: 'Account Mismatch Warning',
                dialogMessage: `This storage source was previously linked to "${previousEmail}", but you just authenticated as "${accountInfo.email}".\n\nConnecting a different account may cause books, reading progress, and statistics to be mixed across accounts.\n\nDo you want to switch accounts to "${accountInfo.email}"?`,
                contentStyles: 'white-space: pre-line;',
                resolver: resolve
              },
              disableCloseOnClick: true
            }
          ]);
        });

        if (wasCanceled) {
          const tokenData = storageOAuthTokens.get(storageSourceName);
          if (tokenData?.refreshToken && storageSourceType === StorageKey.GDRIVE) {
            StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, tokenData.refreshToken);
          }
          storageOAuthTokens.delete(storageSourceName);
          setConnectionState(storageSourceName, StorageConnectionState.DISCONNECTED);
          return false;
        }
      }

      if (storageSource && unlockResult) {
        const tokenData = storageOAuthTokens.get(storageSourceName);
        if (tokenData?.refreshToken) {
          const db = await database.db;
          const updatedContext: RemoteContext = {
            clientId: unlockResult.clientId,
            clientSecret: unlockResult.clientSecret,
            refreshToken: tokenData.refreshToken,
            accountEmail: accountInfo.email || unlockResult.accountEmail,
            accountName: accountInfo.name || unlockResult.accountName
          };

          const newData = storageSource.encryptionDisabled
            ? updatedContext
            : await encrypt(window, JSON.stringify(updatedContext), unlockResult.secret || '');

          await db.put('storageSource', {
            ...storageSource,
            data: newData,
            disconnected: false,
            lastSourceModified: Date.now()
          });
        }
      }

      setConnectionState(storageSourceName, StorageConnectionState.CONNECTED);

      const db = await database.db;
      const updatedSources = await db.getAll('storageSource');
      database.storageSourcesChanged$.next(updatedSources);

      return true;
    } catch (err: any) {
      logger.error(`Reconnect failed for ${storageSourceName}: ${err.message}`);
      setConnectionState(storageSourceName, StorageConnectionState.NEEDS_RECONNECT);
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Reconnect Failed',
            message: `Failed to reconnect ${storageSourceName}: ${err.message}`
          },
          disableCloseOnClick: true
        }
      ]);
      return false;
    }
  }

  static async disconnect(storageSourceName: string): Promise<boolean> {
    const wasCanceled = await new Promise<boolean>((resolve) => {
      dialogManager.dialogs$.next([
        {
          component: ConfirmDialog,
          props: {
            dialogHeader: 'Disconnect Storage Source',
            dialogMessage: `Are you sure you want to disconnect "${storageSourceName}"?\n\nYour local books and remote cloud files will remain completely safe. You can reconnect at any time.`,
            contentStyles: 'white-space: pre-line;',
            resolver: resolve
          },
          disableCloseOnClick: true
        }
      ]);
    });

    if (wasCanceled) {
      return false;
    }

    const isDefault = isAppDefault(storageSourceName);

    if (!isDefault) {
      const db = await database.db;
      const storageSource = await db.get('storageSource', storageSourceName);

      if (storageSource) {
        let unlockResult: StorageUnlockAction | undefined;

        try {
          unlockResult = await unlockStorageData(storageSource, 'Unlinking storage session', {
            requiresSecret: false,
            encryptedData: storageSource.data
          });
        } catch (_) {
          // Continue even if silent unlock fails
        }

        const refreshTokenToRevoke =
          unlockResult?.refreshToken || storageOAuthTokens.get(storageSourceName)?.refreshToken;

        if (refreshTokenToRevoke && storageSource.type === StorageKey.GDRIVE) {
          StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, refreshTokenToRevoke);
        }

        if (unlockResult) {
          const updatedContext: RemoteContext = {
            clientId: unlockResult.clientId,
            clientSecret: unlockResult.clientSecret,
            refreshToken: '',
            accountEmail: unlockResult.accountEmail,
            accountName: unlockResult.accountName
          };

          const newData = storageSource.encryptionDisabled
            ? updatedContext
            : unlockResult.secret
              ? await encrypt(window, JSON.stringify(updatedContext), unlockResult.secret)
              : storageSource.data;

          await db.put('storageSource', {
            ...storageSource,
            data: newData,
            disconnected: true,
            lastSourceModified: Date.now()
          });
        } else {
          await db.put('storageSource', {
            ...storageSource,
            disconnected: true,
            lastSourceModified: Date.now()
          });
        }
      }
    } else {
      const tokenData = storageOAuthTokens.get(storageSourceName);
      if (tokenData?.refreshToken && storageSourceName === StorageSourceDefault.GDRIVE_DEFAULT) {
        StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, tokenData.refreshToken);
      }
    }

    storageOAuthTokens.delete(storageSourceName);
    setConnectionState(storageSourceName, StorageConnectionState.DISCONNECTED);

    const db = await database.db;
    const updatedSources = await db.getAll('storageSource');
    database.storageSourcesChanged$.next(updatedSources);

    return true;
  }
}

export function getConnectionState(
  storageSourceName: string,
  storageSource?: BooksDbStorageSource
): StorageConnectionState {
  const stateMap = storageConnectionStates$.getValue();
  if (stateMap[storageSourceName]) {
    return stateMap[storageSourceName];
  }

  if (storageSource) {
    if (storageSource.type !== StorageKey.GDRIVE && storageSource.type !== StorageKey.ONEDRIVE) {
      return StorageConnectionState.CONNECTED;
    }

    if (storageSource.disconnected) {
      return StorageConnectionState.DISCONNECTED;
    }

    const token = storageOAuthTokens.get(storageSourceName);
    if (token && token.expiration > Date.now()) {
      return StorageConnectionState.CONNECTED;
    }

    if (storageSource.encryptionDisabled && isRemoteContext(storageSource.data)) {
      if (!storageSource.data.refreshToken) {
        return StorageConnectionState.DISCONNECTED;
      }
    }
  }

  return StorageConnectionState.CONNECTED;
}
