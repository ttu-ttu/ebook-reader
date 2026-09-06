<script lang="ts">
  import { browser } from '$app/environment';
  import {
    faArrowsRotate,
    faCircleQuestion,
    faCloudArrowUp,
    faPenToSquare,
    faPlus,
    faRightFromBracket,
    faSpinner,
    faTableList,
    faTrash,
    faTriangleExclamation
  } from '@fortawesome/free-solid-svg-icons';
  import MessageDialog from '$lib/components/message-dialog.svelte';
  import SettingsStorageSource from '$lib/components/settings/settings-storage-source.svelte';
  import { Button, IconButton, List, ListItem, ListSection, Tooltip } from '@custom-ereader/ui';
  import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { gDriveRevokeEndpoint } from '$lib/data/env';
  import {
    StorageOAuthManager,
    storageOAuthTokens,
    storageConnectionStates$,
    getConnectionState,
    StorageConnectionState
  } from '$lib/data/storage/storage-oauth-manager';
  import {
    isAppDefault,
    isRemoteContext,
    setStorageSourceDefault,
    type FsHandle,
    type StorageSourceSaveResult,
    type StorageUnlockAction,
    type RemoteContext,
    unlockStorageData
  } from '$lib/data/storage/storage-source-manager';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { getStorageIconData } from '$lib/data/storage/storage-view';
  import {
    autoReplication$,
    database,
    fsStorageSource$,
    gDriveStorageSource$,
    isOnline$,
    oneDriveStorageSource$,
    syncTarget$
  } from '$lib/data/store';
  import { AutoReplicationType } from '$lib/functions/replication/replication-options';
  import { dummyFn } from '$lib/functions/utils';
  import Fa from 'svelte-fa';

  export let storageSources: BooksDbStorageSource[];

  let listLoading = true;
  let listTooltip = 'Allows you to add a custom set of credentials';

  $: if (storageSources) {
    listLoading = false;
  }

  $: fileSystemAvailable = browser && 'showDirectoryPicker' in window;

  $: if (fileSystemAvailable) {
    listTooltip += ' or filesystem access';
  }

  function isSyncTarget(name: string, referenceName: string) {
    return name === referenceName;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function isStorageSourceDefault(name: string, type: StorageKey, _sources: string[] = []) {
    let configuredIsSourceDefault = false;

    switch (type) {
      case StorageKey.GDRIVE:
        configuredIsSourceDefault = name === $gDriveStorageSource$;
        break;
      case StorageKey.ONEDRIVE:
        configuredIsSourceDefault = name === $oneDriveStorageSource$;
        break;
      case StorageKey.FS:
        configuredIsSourceDefault = name === $fsStorageSource$;
        break;
      default:
        break;
    }

    return configuredIsSourceDefault;
  }

  async function modifyStorageSource(storageSource?: BooksDbStorageSource) {
    let configuredRemoteData: StorageUnlockAction | undefined;
    let configuredFSData: FsHandle | undefined;

    if (storageSource && storageSource.type !== StorageKey.FS) {
      const unlockResult = await unlockStorageData(
        storageSource,
        'You are trying to access protected data',
        {
          action: `Enter the correct password for ${storageSource.name} to proceed`,
          encryptedData: storageSource.data
        }
      );

      if (!unlockResult) {
        return;
      }

      configuredRemoteData = unlockResult;
    } else if (storageSource && isFSHandle(storageSource.type, storageSource.data)) {
      configuredFSData = {
        directoryHandle: storageSource.data.directoryHandle,
        fsPath: storageSource.data.fsPath
      };
    }

    const saveResult = await new Promise<StorageSourceSaveResult>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: SettingsStorageSource,
          props: {
            configuredName: storageSource?.name,
            configuredType: storageSource?.type,
            configuredIsSyncTarget: storageSource ? $syncTarget$ === storageSource.name : false,
            configuredIsStorageSourceDefault: storageSource
              ? isStorageSourceDefault(storageSource.name, storageSource.type)
              : false,
            configuredFSData,
            configuredRemoteData,
            configuredStoredInManager: storageSource?.storedInManager,
            configuredEncryptionDisabled: storageSource?.encryptionDisabled,
            resolver
          },
          disableCloseOnClick: true
        }
      ]);
    });

    if (!saveResult) {
      return;
    }

    if (saveResult.old) {
      const oldToken = storageOAuthTokens.get(saveResult.old);

      storageOAuthTokens.delete(saveResult.old);

      if (oldToken && saveResult.new.type === storageSource?.type) {
        storageOAuthTokens.set(saveResult.new.name, oldToken);
      }

      database.storageSourcesChanged$.next(
        storageSources.map((entry) => (entry.name === saveResult.old ? saveResult.new : entry))
      );
    } else {
      database.storageSourcesChanged$.next([...storageSources, saveResult.new]);
    }
  }

  function isFSHandle(
    type: StorageKey,
    data: FsHandle | ArrayBuffer | RemoteContext
  ): data is FsHandle {
    return data && type === StorageKey.FS;
  }

  async function deleteStorageSource(
    storageSource: BooksDbStorageSource,
    wasSyncTarget: boolean,
    wasSourceDefault: boolean
  ) {
    const unlockResult = await unlockStorageData(
      storageSource,
      storageSource.type === StorageKey.FS
        ? 'You are trying to delete data'
        : 'You are trying to delete protected data',
      {
        action:
          storageSource.type === StorageKey.FS
            ? `Please confirm to proceed with deleting ${storageSource.name}`
            : `Enter the correct password for ${storageSource.name} to proceed`,
        requiresSecret: storageSource.type !== StorageKey.FS,
        showCancel: true,
        encryptedData: storageSource.type !== StorageKey.FS ? storageSource.data : undefined
      }
    );

    if (!unlockResult) {
      return;
    }

    const invalidateToken = storageSource.type === StorageKey.GDRIVE && unlockResult.refreshToken;

    if (invalidateToken && !$isOnline$) {
      dialogManager.dialogs$.next([
        {
          component: MessageDialog,
          props: {
            title: 'Error',
            message: 'You need to be online to delete this storage source'
          },
          disableCloseOnClick: true
        }
      ]);
      return;
    }

    await database.deleteStorageSource(storageSource, wasSyncTarget, wasSourceDefault);

    storageOAuthTokens.delete(storageSource.name);

    if (invalidateToken && unlockResult.refreshToken) {
      StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, unlockResult.refreshToken);
    }

    database.storageSourcesChanged$.next(
      storageSources.filter((source) => source.name !== storageSource.name)
    );
  }

  let actionLoading: Record<string, boolean> = {};

  function getAccountEmail(storageSource: BooksDbStorageSource) {
    if (storageSource.encryptionDisabled && isRemoteContext(storageSource.data)) {
      return storageSource.data.accountEmail || '';
    }
    return '';
  }

  async function reconnectStorageSource(storageSource: BooksDbStorageSource) {
    actionLoading[storageSource.name] = true;
    actionLoading = { ...actionLoading };

    try {
      await StorageOAuthManager.reconnect(window, storageSource.name);
    } finally {
      actionLoading[storageSource.name] = false;
      actionLoading = { ...actionLoading };
    }
  }

  async function disconnectStorageSource(storageSource: BooksDbStorageSource) {
    actionLoading[storageSource.name] = true;
    actionLoading = { ...actionLoading };

    try {
      await StorageOAuthManager.disconnect(storageSource.name);
    } finally {
      actionLoading[storageSource.name] = false;
      actionLoading = { ...actionLoading };
    }
  }
</script>

<ListSection title="Storage Sources" description={listTooltip}>
  <div slot="actions" class="flex items-center gap-2">
    {#if $autoReplication$ !== AutoReplicationType.Off && !$syncTarget$}
      <Tooltip
        content="Auto import/export enabled but no sync target selected from list"
        placement="bottom"
      >
        <span
          class="flex items-center gap-1.5 text-xs font-medium px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md"
        >
          <Fa icon={faTriangleExclamation} />
          <span class="hidden sm:inline">No sync target</span>
        </span>
      </Tooltip>
    {/if}
    <Button
      size="sm"
      variant="primary"
      disabled={!storageSources}
      on:click={() => modifyStorageSource()}
    >
      <Fa icon={faPlus} class="mr-1.5" />
      <span>Add Source</span>
    </Button>
  </div>

  {#if !listLoading && storageSources}
    {#if storageSources.length === 0}
      <div class="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No storage sources configured. Click "Add Source" above to connect cloud or local storage.
      </div>
    {:else}
      <List variant="bordered" divided={true}>
        {#each storageSources as storageSource (storageSource.name)}
          {@const icon = getStorageIconData(storageSource.type)}
          {@const isDefault = isAppDefault(storageSource.name)}
          {@const storageSourceIsSyncTarget = isSyncTarget(storageSource.name, $syncTarget$)}
          {@const storageSourceIsSourceDefault = isStorageSourceDefault(
            storageSource.name,
            storageSource.type,
            [$gDriveStorageSource$, $oneDriveStorageSource$, $fsStorageSource$]
          )}
          {@const isCloudSource =
            storageSource.type === StorageKey.GDRIVE || storageSource.type === StorageKey.ONEDRIVE}
          {@const connectionState =
            $storageConnectionStates$[storageSource.name] ||
            getConnectionState(storageSource.name, storageSource)}
          {@const accountEmail = getAccountEmail(storageSource)}
          {@const isLoading = !!actionLoading[storageSource.name]}

          <ListItem
            headline={storageSource.name}
            description={isCloudSource
              ? connectionState === StorageConnectionState.CONNECTED
                ? accountEmail
                  ? `Connected (${accountEmail})`
                  : 'Connected'
                : connectionState === StorageConnectionState.NEEDS_RECONNECT
                  ? 'Session Expired — Reconnect required'
                  : 'Disconnected'
              : 'Local file system storage'}
          >
            <div
              slot="prefix"
              class="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300"
            >
              <svg class="h-5 w-5 fill-current" viewBox={icon.viewBox}>
                <path d={icon.d} />
              </svg>
            </div>

            <div class="flex items-center gap-1.5 mt-1">
              {#if isDefault}
                <span
                  class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 tracking-wider"
                >
                  Default
                </span>
              {/if}
              {#if storageSourceIsSyncTarget}
                <span
                  class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 tracking-wider"
                >
                  Sync Target
                </span>
              {/if}
              {#if storageSourceIsSourceDefault}
                <span
                  class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 tracking-wider"
                >
                  Type Default
                </span>
              {/if}
            </div>

            <div slot="suffix" class="flex items-center gap-1">
              {#if isCloudSource}
                <Tooltip
                  content={connectionState === StorageConnectionState.CONNECTED
                    ? 'Reconnect session'
                    : 'Connect session'}
                >
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label={connectionState === StorageConnectionState.CONNECTED
                      ? 'Reconnect session'
                      : 'Connect session'}
                    disabled={isLoading}
                    on:click={() => !isLoading && reconnectStorageSource(storageSource)}
                  >
                    <Fa
                      icon={isLoading ? faSpinner : faArrowsRotate}
                      spin={isLoading}
                      class={connectionState === StorageConnectionState.NEEDS_RECONNECT
                        ? 'text-amber-500'
                        : ''}
                    />
                  </IconButton>
                </Tooltip>

                {#if connectionState === StorageConnectionState.CONNECTED}
                  <Tooltip content="Disconnect session">
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label="Disconnect session"
                      disabled={isLoading}
                      on:click={() => !isLoading && disconnectStorageSource(storageSource)}
                    >
                      <Fa icon={faRightFromBracket} />
                    </IconButton>
                  </Tooltip>
                {/if}
              {/if}

              {#if !isDefault}
                <Tooltip content="Edit source settings">
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="Edit source"
                    on:click={() => modifyStorageSource(storageSource)}
                  >
                    <Fa icon={faPenToSquare} />
                  </IconButton>
                </Tooltip>
              {/if}

              <Tooltip
                content={storageSourceIsSyncTarget
                  ? 'Current Sync Target (click to unset)'
                  : 'Set as Sync Target'}
              >
                <IconButton
                  size="sm"
                  variant={storageSourceIsSyncTarget ? 'primary' : 'ghost'}
                  active={storageSourceIsSyncTarget}
                  label="Toggle sync target"
                  on:click={() =>
                    syncTarget$.next($syncTarget$ === storageSource.name ? '' : storageSource.name)}
                >
                  <Fa icon={faCloudArrowUp} />
                </IconButton>
              </Tooltip>

              <Tooltip
                content={storageSourceIsSourceDefault
                  ? 'Default for this source type (click to unset)'
                  : 'Set as default for this source type'}
              >
                <IconButton
                  size="sm"
                  variant={storageSourceIsSourceDefault ? 'secondary' : 'ghost'}
                  active={storageSourceIsSourceDefault}
                  label="Toggle type default"
                  on:click={() =>
                    setStorageSourceDefault(
                      storageSourceIsSourceDefault ? '' : storageSource.name,
                      storageSource.type
                    )}
                >
                  <Fa icon={faTableList} />
                </IconButton>
              </Tooltip>

              {#if !isDefault}
                <Tooltip content="Delete source">
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="Delete source"
                    class="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    on:click={() =>
                      deleteStorageSource(
                        storageSource,
                        storageSourceIsSyncTarget,
                        storageSourceIsSourceDefault
                      )}
                  >
                    <Fa icon={faTrash} />
                  </IconButton>
                </Tooltip>
              {/if}
            </div>
          </ListItem>
        {/each}
      </List>
    {/if}
  {:else}
    <div class="py-8 flex justify-center text-xl text-zinc-400">
      <Fa icon={faSpinner} spin />
    </div>
  {/if}
</ListSection>
