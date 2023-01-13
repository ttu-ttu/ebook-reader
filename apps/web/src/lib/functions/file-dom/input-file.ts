/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

export function inputFile(el: HTMLInputElement, action: (fileList: FileList) => void) {
  const handleChange = () => {
    if (el.files?.length) {
      action(el.files);
      // eslint-disable-next-line no-param-reassign
      el.value = '';
    }
  };

  el.addEventListener('change', handleChange);

  return {
    destroy() {
      el.removeEventListener('change', handleChange);
    }
  };
}
