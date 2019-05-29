/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';
import { indexBy } from 'lodash';

const watchID = 'watchID';
const watchName = 'watch Name';
const updatedName = 'updatedName';
export default function ({ getService, getPageObjects }) {
  const browser = getService('browser');
  const testSubjects = getService('testSubjects');
  const log = getService('log');
  const PageObjects = getPageObjects(['security', 'common', 'header', 'settings', 'watcher']);

  describe('threshold watch', function () {
    before('initialize tests', async () => {
      await browser.setWindowSize(1600, 1000);
      await PageObjects.common.navigateToApp('settings');
      await testSubjects.click('watcher');
      await PageObjects.watcher.deleteAllWatches();
    });

    it('create and save a new threshold watch', async () => {
      await PageObjects.watcher.createThresholdAlert(watchID, watchName);
      const watch = await PageObjects.watcher.getWatch(watchID);
      expect(watch.id).to.be(watchID);
      expect(watch.name).to.be(watchName);
    });

    //delete the watch
    it('should delete the advanced watch', async () => {
      const watchList = indexBy(await PageObjects.watcher.getAllWatches(), 'id');
      log.debug(watchList);
      expect(watchList.watchID.name).to.eql([updatedName]);
      await PageObjects.watcher.deleteWatch(watchID);
      await testSubjects.click('confirmModalConfirmButton');
      await PageObjects.header.waitUntilLoadingHasFinished();
    });
  });
}
