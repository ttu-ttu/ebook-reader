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
    type StorageSourceSaveResult,
    type StorageUnlockAction
  } from '$lib/data/storage/storage-source-manager';
  import { StorageKey } from '$lib/data/storage/storage-types';
  import { database, isOnline$ } from '$lib/data/store';
  import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
  import { createEventDispatcher } from 'svelte';
  import Fa from 'svelte-fa';

  export let configuredName: string;
  export let configuredIsSyncTarget: boolean;
  export let configuredIsStorageSourceDefault: boolean;
  export let configuredType: StorageKey;
  export let configuredRemoteData: StorageUnlockAction;
  export let configuredFSData: FsHandle;
  export let configuredStoredInManager: boolean;
  export let configuredEncryptionDisabled: boolean;
  export let resolver: (arg0: StorageSourceSaveResult | undefined) => void;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  const storageSourceRefreshToken = configuredRemoteData?.refreshToken || '';

  let containerElm: HTMLElement;
  let nameElm: HTMLInputElement;
  let pwElm: HTMLInputElement;
  let pwConfirmElm: HTMLInputElement;
  let error = '';
  const passwordManagerAvailable = 'PasswordCredential' in window;
  let storageSourceName = configuredName || '';
  let storageSourceIsSyncTarget = configuredIsSyncTarget || false;
  let storageSourceIsSourceDefault = configuredIsStorageSourceDefault || false;
  let storageSourceType = configuredType || StorageKey.GDRIVE;
  let storageSourceClientId = configuredRemoteData?.clientId || '';
  let storageSourceClientSecret = configuredRemoteData?.clientSecret || '';
  let directoryHandle: FileSystemDirectoryHandle | undefined = configuredFSData?.directoryHandle;
  let handleFsPath = configuredFSData?.fsPath || '';
  let storageSourceStoredInManager =
    (passwordManagerAvailable && configuredStoredInManager) || false;
  let storageSourceEncryptionDisabled = configuredEncryptionDisabled || false;
  let storageSourceTypes = [
    { key: StorageKey.GDRIVE, label: 'GDrive' },
    { key: StorageKey.ONEDRIVE, label: 'OneDrive' }
  ];

  $: if (browser && 'showDirectoryPicker' in window) {
    storageSourceTypes = [...storageSourceTypes, { key: StorageKey.FS, label: 'Filesystem' }];
  }

  $: setInitialPassword(pwElm);

  $: setInitialPassword(pwConfirmElm);

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

      if (storageSourceStoredInManager) {
        await navigator.credentials
          .store(
            // eslint-disable-next-line no-undef
            new PasswordCredential({
              id: storageSourceName,
              name: `${storageSourceName} (${storageSourceType})`,
              password: pwConfirmElm.value
            })
          )
          .catch(({ message }: any) => {
            throw new Error(`Failed to store Password: ${message}`);
          });
      }

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

        if (storageSourceEncryptionDisabled) {
          storageSourceData = {
            clientId: storageSourceClientId,
            clientSecret: storageSourceClientSecret,
            refreshToken: invalidateToken ? '' : storageSourceRefreshToken
          };
        } else {
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
      }

      const toSave: BooksDbStorageSource = {
        name: storageSourceName,
        type: storageSourceType,
        storedInManager: storageSourceStoredInManager,
        encryptionDisabled: storageSourceEncryptionDisabled,
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

  function setInitialPassword(element: HTMLInputElement) {
    if (element && configuredStoredInManager && configuredRemoteData.secret) {
      const elm = element;

      elm.value = configuredRemoteData.secret;
    }
  }
</script>

<DialogTemplate>
  <div
    class="flex flex-col p-2 max-h-[50vh] overflow-auto sm:max-h-[75vh]"
    slot="content"
    bind:this={containerElm}
  >
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
          storageSourceStoredInManager = false;
          storageSourceEncryptionDisabled = false;
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
      <input
        class="mt-4"
        type="password"
        placeholder="Password"
        required={!storageSourceEncryptionDisabled}
        disabled={storageSourceEncryptionDisabled}
        bind:this={pwElm}
      />
      <input
        class="mt-4"
        type="password"
        placeholder="Confirm Password"
        required={!storageSourceEncryptionDisabled}
        disabled={storageSourceEncryptionDisabled}
        bind:this={pwConfirmElm}
      />
      {#if passwordManagerAvailable}
        <div class="mt-4">
          <input
            id="cbx-store-in-manager"
            type="checkbox"
            bind:checked={storageSourceStoredInManager}
            on:change={() => {
              if (storageSourceStoredInManager && storageSourceEncryptionDisabled) {
                storageSourceEncryptionDisabled = false;
              }
            }}
          />
          <label for="cbx-store-in-manager" class="ml-2 mr-6">Store in Password Manager</label>
        </div>
      {/if}
      <div class="mt-4">
        <input
          id="cbx-disable-encryption"
          type="checkbox"
          bind:checked={storageSourceEncryptionDisabled}
          on:change={() => {
            if (storageSourceEncryptionDisabled) {
              storageSourceStoredInManager = false;
              pwElm.value = '';
              pwConfirmElm.value = '';
            }
          }}
        />
        <label for="cbx-disable-encryption" class="ml-2 mr-6">Disable Password Encryption</label>
      </div>
    {/if}
    {#if storageSourceStoredInManager || storageSourceEncryptionDisabled}
      <div class="flex items-center my-4 max-w-xs">
        <Fa icon={faTriangleExclamation} />
        <span class="ml-2">
          Make sure to understand the
          <a
            class="text-red-500"
            href="https://github.com/ttu-ttu/ebook-reader?tab=readme-ov-file#security-considerations"
            target="_blank"
          >
            Implications
          </a>
          of your choosen Settings
        </span>
      </div>
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

<style>
  input:disabled {
    cursor: not-allowed;
  }
</style>
