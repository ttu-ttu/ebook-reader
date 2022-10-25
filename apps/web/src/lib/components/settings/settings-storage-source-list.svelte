<script lang="ts">
  import { browser } from '$app/environment';
  import {
    faCircleQuestion,
    faCloudArrowUp,
    faPenToSquare,
    faPlus,
    faSpinner,
    faTableList,
    faTrash,
    faTriangleExclamation
  } from '@fortawesome/free-solid-svg-icons';
  import Popover from '$lib/components/popover/popover.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import SettingsStorageSource from '$lib/components/settings/settings-storage-source.svelte';
  import StorageUnlock from '$lib/components/storage-unlock.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
  import { dialogManager } from '$lib/data/dialog-manager';
  import { gDriveRevokeEndpoint } from '$lib/data/env';
  import { StorageOAuthManager, storageOAuthTokens } from '$lib/data/storage/storage-oauth-manager';
  import {
    isAppDefault,
    setStorageSourceDefault,
    type FsHandle,
    type StorageSourceSaveResult,
    type StorageUnlockAction
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
  import Fa from 'svelte-fa';
  import MessageDialog from '../message-dialog.svelte';

  export let storageSources: BooksDbStorageSource[];

  let listLoading = true;
  let listTooltip = 'Allows you to add a custom set of credentials';

  $: if (storageSources) {
    listLoading = false;
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
      const result = await new Promise<StorageUnlockAction | undefined>((resolver) => {
        dialogManager.dialogs$.next([
          {
            component: StorageUnlock,
            props: {
              description: 'You are trying to access protected data',
              action: `Enter the correct password for ${storageSource.name} to proceed`,
              encryptedData: storageSource.data,
              resolver
            },
            disableCloseOnClick: true
          }
        ]);
      });

      if (!result) {
        return;
      }

      configuredRemoteData = result;
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

  function isFSHandle(type: StorageKey, data: FsHandle | ArrayBuffer): data is FsHandle {
    return data && type === StorageKey.FS;
  }

  async function deleteStorageSource(
    storageSource: BooksDbStorageSource,
    wasSyncTarget: boolean,
    wasSourceDefault: boolean
  ) {
    const result = await new Promise<StorageUnlockAction | undefined>((resolver) => {
      dialogManager.dialogs$.next([
        {
          component: StorageUnlock,
          props: {
            description:
              storageSource.type === StorageKey.FS
                ? 'You are trying to delete data'
                : 'You are trying to delete protected data',
            action:
              storageSource.type === StorageKey.FS
                ? `Please confirm to proceed with deleting ${storageSource.name}`
                : `Enter the correct password for ${storageSource.name} to proceed`,
            requiresSecret: storageSource.type !== StorageKey.FS,
            showCancel: true,
            encryptedData: storageSource.type !== StorageKey.FS ? storageSource.data : undefined,
            resolver
          },
          disableCloseOnClick: true
        }
      ]);
    });

    if (!result) {
      return;
    }

    const invalidateToken = storageSource.type === StorageKey.GDRIVE && result.refreshToken;

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

    if (invalidateToken && result.refreshToken) {
      StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, result.refreshToken);
    }

    database.storageSourcesChanged$.next(
      storageSources.filter((source) => source.name !== storageSource.name)
    );
  }

  $: if (browser && 'showDirectoryPicker' in window) {
    listTooltip += ' or filesystem access';
  }
</script>

<div class="mb-8 sm:col-span-2 lg:col-span-3">
  <div class="flex">
    <div class="flex grow">
      <h1 class="mb-2 text-xl font-medium">
        <span class="capitalize">Storage Sources</span>
      </h1>
      <Popover contentText={listTooltip} contentStyles="padding: 0.5rem;">
        <Fa icon={faCircleQuestion} slot="icon" class="mx-2" />
      </Popover>
      {#if $autoReplication$ !== AutoReplicationType.Off && !$syncTarget$}
        <Popover
          contentText={'Auto import/export enabled but no source as sync target from list selected'}
          contentStyles="padding: 0.25rem;"
        >
          <Fa icon={faTriangleExclamation} slot="icon" class="mx-2" />
        </Popover>
      {/if}
    </div>
    <button
      class={buttonClasses}
      class:cursor-not-allowed={!storageSources}
      disabled={!storageSources}
      on:click={() => {
        modifyStorageSource();
      }}
    >
      <div class="flex items-center justify-center">
        <Fa icon={faPlus} />
        <span class="ml-1 hidden sm:block">Add</span>
      </div>
      <Ripple />
    </button>
  </div>
  <hr class="border border-black" />
  <div class="mt-6">
    {#if !listLoading && storageSources}
      <div class="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {#each storageSources as storageSource (storageSource.name)}
          {@const icon = getStorageIconData(storageSource.type)}
          {@const isDefault = isAppDefault(storageSource.name)}
          {@const storageSourceIsSyncTarget = isSyncTarget(storageSource.name, $syncTarget$)}
          {@const storageSourceIsSourceDefault = isStorageSourceDefault(
            storageSource.name,
            storageSource.type,
            [$gDriveStorageSource$, $oneDriveStorageSource$, $fsStorageSource$]
          )}
          <div class="flex flex-col">
            <div class="flex">
              <svg
                class="inline-block h-6 w-6 self-center"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={icon.viewBox}
              >
                <path class="fill-current" d={icon.d} />
              </svg>
              <div class="ml-3 self-center">{storageSource.name}</div>
            </div>
            <div class="mt-4 flex">
              <div
                class="mr-4 cursor-pointer"
                class:hidden={isDefault}
                on:click={() => modifyStorageSource(storageSource)}
              >
                <Fa icon={faPenToSquare} />
              </div>
              <div
                title="Toggle source as sync target"
                class="mr-4 cursor-pointer"
                class:opacity-50={!storageSourceIsSyncTarget}
                on:click={() =>
                  syncTarget$.next($syncTarget$ === storageSource.name ? '' : storageSource.name)}
              >
                <Fa icon={faCloudArrowUp} />
              </div>

              <div
                title="Toggle source as data source for this type"
                class="mr-4 cursor-pointer"
                class:opacity-50={!storageSourceIsSourceDefault}
                on:click={() =>
                  setStorageSourceDefault(
                    storageSourceIsSourceDefault ? '' : storageSource.name,
                    storageSource.type
                  )}
              >
                <Fa icon={faTableList} />
              </div>

              <div
                class="cursor-pointer"
                class:hidden={isDefault}
                on:click={() =>
                  deleteStorageSource(
                    storageSource,
                    storageSourceIsSyncTarget,
                    storageSourceIsSourceDefault
                  )}
              >
                <Fa icon={faTrash} />
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-xl">
        <Fa icon={faSpinner} spin />
      </div>
    {/if}
  </div>
  <div />
</div>
