/**
 * @license BSD-3-Clause
 * Copyright (c) 2023, ッツ Reader Authors
 * All rights reserved.
 */

import {
  faBug,
  faChartLine,
  faCog,
  faFileArrowUp,
  faFileZipper,
  faFolderPlus,
  faImages,
  faSignOutAlt,
  faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';

export const mergeEntries = {
  MANAGE: { routeId: '/manage', label: 'Manager', icon: faSignOutAlt },
  SETTINGS: { routeId: '/settings', label: 'Settings', icon: faCog },
  STATISTICS: { routeId: '/statistics', label: 'Statistics', icon: faChartLine },
  READER_IMAGE_GALLERY: { routeId: '', label: 'Images', icon: faImages },
  DOMAIN_HINT: { routeId: '', label: 'Domain Hint', icon: faTriangleExclamation },
  BUG_REPORT: { routeId: '', label: 'Bug Report', icon: faBug },
  FOLDER_IMPORT: { routeId: '', label: 'Import Folder(s)', icon: faFolderPlus },
  FILE_IMPORT: { routeId: '', label: 'Import File(s)', icon: faFileArrowUp },
  BACKUP_IMPORT: { routeId: '', label: 'Import Backup', icon: faFileZipper }
};
