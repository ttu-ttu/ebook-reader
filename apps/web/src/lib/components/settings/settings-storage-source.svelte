<script lang="ts">
  import { browser } from '$app/environment';
  import DialogTemplate from '$lib/components/dialog-template.svelte';
  import Ripple from '$lib/components/ripple.svelte';
  import { buttonClasses } from '$lib/css-classes';
  import type { BooksDbStorageSource } from '$lib/data/database/books-db/versions/books-db';
  import { gDriveRevokeEndpoint } from '$lib/data/env';
  import { BaseStorageHandler } from '$lib/data/storage/handler/base-handler';
  import { getStorageHandler } from '$lib/data/storage/storage-handler-factory';
  import { StorageOAuthManager, storageOAuthTokens } from '$lib/data/storage/storage-oauth-manager';
  import {
    encrypt,
    isAppDefault,
    type FsHandle,
    type RemoteContext,
    type StorageSourceSaveResult
  } from '$lib/data/storage/storage-source-manager';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { database, isOnline$ } from '$lib/data/store';
  import { createEventDispatcher } from 'svelte';

  export let configuredName: string;
  export let configuredIsSyncTarget: boolean;
  export let configuredIsStorageSourceDefault: boolean;
  export let configuredType: StorageKey;
  export let configuredRemoteData: RemoteContext;
  export let configuredFSData: FsHandle;
  export let resolver: (arg0: StorageSourceSaveResult | undefined) => void;

  let containerElm: HTMLElement;
  let nameElm: HTMLInputElement;
  let pwElm: HTMLInputElement;
  let pwConfirmElm: HTMLInputElement;
  let error = '';

  let storageSourceName = configuredName || '';
  let storageSourceIsSyncTarget = configuredIsSyncTarget || false;
  let storageSourceIsSourceDefault = configuredIsStorageSourceDefault || false;
  let storageSourceType = configuredType || StorageKey.GDRIVE;
  let storageSourceClientId = configuredRemoteData?.clientId || '';
  let storageSourceClientSecret = configuredRemoteData?.clientSecret || '';
  const storageSourceRefreshToken = configuredRemoteData?.refreshToken || '';
  let directoryHandle: FileSystemDirectoryHandle | undefined = configuredFSData?.directoryHandle;
  let handleFsPath = configuredFSData?.fsPath || '';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let storageSourceTypes = [
    { key: StorageKey.GDRIVE, label: 'GDrive' },
    { key: StorageKey.ONEDRIVE, label: 'OneDrive' }
  ];

  async function selectDirectory() {
    resetCustomValidity();

    try {
      const dirHandle = await window.showDirectoryPicker({
        id: 'ttu-reader-root',
        mode: 'readwrite'
      });
      directoryHandle = await dirHandle.getDirectoryHandle(BaseStorageHandler.rootName, {
        create: true
      });
      handleFsPath = `${dirHandle.name === '\\' ? '' : `${dirHandle.name}/`}${
        BaseStorageHandler.rootName
      }`;
    } catch (err: any) {
      directoryHandle = undefined;
      handleFsPath = '';

      if (err.name !== 'AbortError') {
        error = err.message;
      }
    }
  }

  async function save() {
    resetCustomValidity();

    if (
      ![...containerElm.querySelectorAll('input')].every((elm) => {
        let isValid = elm.reportValidity();

        if (!isValid) {
          return false;
        }

        if (elm === nameElm) {
          if (storageSourceType === StorageKey.FS && !directoryHandle) {
            nameElm.setCustomValidity('You need to select a directory');
            isValid = false;
          } else if (isAppDefault(storageSourceName)) {
            nameElm.setCustomValidity('Please select a different name');
            isValid = false;
          }
        } else if (elm === pwConfirmElm && pwElm.value !== pwConfirmElm.value) {
          pwConfirmElm.setCustomValidity('Password does not match');
          isValid = false;
        }

        if (!isValid) {
          elm.reportValidity();
        }

        return isValid;
      })
    ) {
      return;
    }

    try {
      let storageSourceData;
      let credentialsChanged = false;
      let invalidateToken = false;

      if (storageSourceType === StorageKey.FS) {
        if (!directoryHandle) {
          throw new Error('Directory handle not defined');
        }

        storageSourceData = { directoryHandle, fsPath: handleFsPath };
      } else {
        credentialsChanged =
          storageSourceClientId !== configuredRemoteData?.clientId ||
          storageSourceClientSecret !== configuredRemoteData?.clientSecret;
        invalidateToken = !storageSourceClientSecret || credentialsChanged;

        const willInvalidateToken =
          invalidateToken &&
          configuredType === StorageKey.GDRIVE &&
          configuredRemoteData?.refreshToken;

        if (willInvalidateToken && !$isOnline$) {
          throw new Error('You need to be online in order to make this change to the credentials');
        }

        storageSourceData = await encrypt(
          window,
          JSON.stringify({
            clientId: storageSourceClientId,
            clientSecret: storageSourceClientSecret,
            refreshToken: invalidateToken ? '' : storageSourceRefreshToken
          }),
          pwConfirmElm.value
        );
      }

      const toSave: BooksDbStorageSource = {
        name: storageSourceName,
        type: storageSourceType,
        data: storageSourceData,
        lastSourceModified: Date.now()
      };

      await database.saveStorageSource(
        toSave,
        configuredName,
        storageSourceIsSyncTarget,
        storageSourceIsSourceDefault
      );

      if (
        invalidateToken &&
        configuredType === StorageKey.GDRIVE &&
        configuredRemoteData?.refreshToken
      ) {
        StorageOAuthManager.revokeToken(gDriveRevokeEndpoint, configuredRemoteData.refreshToken);
      }

      if (credentialsChanged) {
        storageOAuthTokens.delete(configuredName);

        if (storageSourceType !== StorageKey.FS) {
          getStorageHandler(window, storageSourceType).clearData();
        }
      }

      if (
        storageSourceType === StorageKey.FS &&
        directoryHandle &&
        !(await configuredFSData?.directoryHandle.isSameEntry(directoryHandle))
      ) {
        getStorageHandler(window, StorageKey.FS).clearData();
      }

      closeDialog({ new: toSave, old: configuredName });
    } catch (err: any) {
      error = err.message;
    }
  }

  function resetCustomValidity() {
    error = '';
    nameElm.setCustomValidity('');
    pwConfirmElm?.setCustomValidity('');
  }

  function closeDialog(data?: StorageSourceSaveResult) {
    resolver(data);
    dispatch('close');
  }

  $: if (browser && 'showDirectoryPicker' in window) {
    storageSourceTypes = [...storageSourceTypes, { key: StorageKey.FS, label: 'Filesystem' }];
  }
</script>

<DialogTemplate>
  <div class="flex flex-col" slot="content" bind:this={containerElm}>
    <input
      required
      type="text"
      placeholder="Name"
      bind:value={storageSourceName}
      bind:this={nameElm}
    />
    <div class="mt-4 flex items-center">
      <input id="cbx-source" type="checkbox" bind:checked={storageSourceIsSyncTarget} />
      <label for="cbx-source" class="ml-2 mr-6">Is Sync Target</label>
      <input id="cbx-manager" type="checkbox" bind:checked={storageSourceIsSourceDefault} />
      <label for="cbx-source" class="ml-2">Is Source Default</label>
    </div>
    <select
      class="my-4"
      bind:value={storageSourceType}
      on:change={() => {
        if (storageSourceType === StorageKey.FS) {
          storageSourceClientId = '';
          storageSourceClientSecret = '';
        } else {
          directoryHandle = undefined;
          handleFsPath = '';
        }
      }}
    >
      {#each storageSourceTypes as sourceType (sourceType.key)}
        <option value={sourceType.key}>
          {sourceType.label}
        </option>
      {/each}
    </select>
    {#if storageSourceType === StorageKey.FS}
      <button class={buttonClasses} on:click={selectDirectory}>
        Select Directory
        <Ripple />
      </button>
      <div class="my-4 text-center">{handleFsPath || 'Nothing selected'}</div>
    {:else}
      <input required type="text" placeholder="Client ID" bind:value={storageSourceClientId} />
      <input
        class="mt-4"
        type="text"
        placeholder="Client Secret"
        bind:value={storageSourceClientSecret}
      />
      <input required class="mt-4" type="password" placeholder="Password" bind:this={pwElm} />
      <input
        required
        class="mt-4"
        type="password"
        placeholder="Confirm Password"
        bind:this={pwConfirmElm}
      />
    {/if}
    {#if error}
      <div class="text-red-500">Error: {error}</div>
    {/if}
  </div>
  <div class="mt-4 flex grow justify-between" slot="footer">
    <button class={buttonClasses} on:click={() => closeDialog()}>
      Cancel
      <Ripple />
    </button>
    <button class={buttonClasses} on:click={save}>
      Save
      <Ripple />
    </button>
  </div>
</DialogTemplate>
