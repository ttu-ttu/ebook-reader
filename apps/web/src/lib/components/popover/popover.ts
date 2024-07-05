/**
 * @license BSD-3-Clause
 * Copyright (c) 2024, ッツ Reader Authors
 * All rights reserved.
 */

import { writable } from 'svelte/store';

function popoverStore() {
  const popovers: symbol[] = [];
  const { subscribe, set, update } = writable(popovers);

  return {
    subscribe,
    set,
    update,
    add(instance: symbol) {
      this.update((instances) => {
        instances.push(instance);
        return instances;
      });
    },
    replace(instance: symbol) {
      this.update((instances) => {
        instances = [instance];
        return instances;
      });
    },
    remove(instance: symbol) {
      this.update((instances) => {
        instances = instances.filter((item) => item !== instance);
        return instances;
      });
    }
  };
}

export const popovers = popoverStore();
