/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

export const basePath = import.meta.env.VITE_BASE_PATH || 'https://reader.ttsu.app';
export const pagePath = import.meta.env.VITE_PAGE_PATH || '';
export const clearConsoleOnReload = !!import.meta.env.VITE_CLEAR_ON_RELOAD || false;
export const storageRootName = import.meta.env.VITE_STORAGE_ROOT_NAME || 'ttu-reader-data';
export const gDriveAuthEndpoint =
  import.meta.env.VITE_GDRIVE_AUTH_ENDPOINT || 'https://accounts.google.com/o/oauth2/v2/auth';
export const gDriveTokenEndpoint =
  import.meta.env.VITE_GDRIVE_TOKEN_ENDPOINT || 'https://oauth2.googleapis.com/token';
export const gDriveRefreshEndpoint =
  import.meta.env.VITE_GDRIVE_REFRESH_ENDPOINT || 'https://oauth2.googleapis.com/token';
export const gDriveRevokeEndpoint =
  import.meta.env.VITE_GDRIVE_REVOKE_ENDPOINT || 'https://oauth2.googleapis.com/revoke';
export const gDriveScope =
  import.meta.env.VITE_GDRIVE_SCOPE || 'https://www.googleapis.com/auth/drive.file';
export const gDriveClientId = import.meta.env.VITE_GDRIVE_CLIENT_ID || '';
export const gDriveClientSecret = import.meta.env.VITE_GDRIVE_CLIENT_SECRET || '';
export const oneDriveAuthEndpoint =
  import.meta.env.VITE_ONEDRIVE_AUTH_ENDPOINT ||
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize';
export const oneDriveTokenEndpoint =
  import.meta.env.VITE_ONEDRIVE_TOKEN_ENDPOINT ||
  'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
export const oneDriveDiscoveryEndpoint =
  import.meta.env.VITE_ONEDRIVE_DISCOVERY ||
  'https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration';
export const oneDriveScope = import.meta.env.VITE_ONEDRIVE_SCOPE || 'files.readwrite';
export const oneDriveClientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '';
export const oneDriveClientSecret = import.meta.env.VITE_ONEDRIVE_CLIENT_SECRET || '';
