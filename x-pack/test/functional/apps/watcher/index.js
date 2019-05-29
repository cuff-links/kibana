/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

export default function ({ loadTestFile }) {
  describe('watcher app', function () {
    this.tags('ciGroup1');

    loadTestFile(require.resolve('./threshold_watch_test'));
    loadTestFile(require.resolve('./advanced_watch_test'));
  });
}
