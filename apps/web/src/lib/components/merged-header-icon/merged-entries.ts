/**
 * @license BSD-3-Clause
 * Copyright (c) 2022, ッツ Reader Authors
 * All rights reserved.
 */

import {
  faBug,
  faCog,
  faFileArrowUp,
  faFileZipper,
  faFolderPlus,
  faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';

export const mergeEntries = {
  MANAGE: { routeId: '/manage', label: 'Manager', icon: faSignOutAlt },
  SETTINGS: { routeId: '/settings', label: 'Settings', icon: faCog },
  BUG_REPORT: { routeId: '', label: 'Bug Report', icon: faBug },
  FOLDER_IMPORT: { routeId: '', label: 'Import Folder(s)', icon: faFolderPlus },
  FILE_IMPORT: { routeId: '', label: 'Import File(s)', icon: faFileArrowUp },
  BACKUP_IMPORT: { routeId: '', label: 'Import Backup', icon: faFileZipper }
};
