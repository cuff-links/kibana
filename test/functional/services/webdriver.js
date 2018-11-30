/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const geckoDriver = require('geckodriver');
const chromeDriver = require('chromedriver');

export async function WebdriverProvider({ getService }) {
  const lifecycle = getService('lifecycle');
  const log = getService('log');
  const possibleBrowsers = ['chrome', 'firefox', 'ie'];
  const browserType = process.env.TEST_BROWSER_TYPE || 'chrome';
  const throttleOption = process.env.TEST_THROTTLE_NETWORK;



  if (!possibleBrowsers.includes(browserType)) {
    throw new Error(`Unexpected TEST_BROWSER_TYPE "${browserType}". Valid options are ` + possibleBrowsers.join(','));
  }

  const chromeOptions = new chrome.Options();
  const prefs = new webdriver.logging.Preferences();
  const loggingPref = prefs.setLevel(webdriver.logging.Type.BROWSER, webdriver.logging.Level.ALL);
  chromeOptions.addArguments('verbose');
  chromeOptions.setLoggingPrefs(loggingPref);
  //chromeOptions.headless();
  // chromeOptions.windowSize({ width: 1200, height: 1100 });

  log.debug(chromeDriver.path);
  log.debug(geckoDriver.path);


  const chromeService = new chrome.ServiceBuilder(chromeDriver.path)
    // .loggingTo(process.stdout)
    .enableVerboseLogging();

  const firefoxOptions = new firefox.Options();
  // firefoxOptions.headless();
  // chromeOptions.windowSize({ width: 1200, height: 1100 });

  const firefoxService = new firefox.ServiceBuilder(geckoDriver.path)
    // .loggingTo(process.stdout)
    .enableVerboseLogging();

  const driver = await new webdriver.Builder()
    .forBrowser(browserType)
    .setChromeOptions(chromeOptions)
    .setChromeService(chromeService)
    .setFirefoxOptions(firefoxOptions)
    .setFirefoxService(firefoxService)
    .build();

  if (throttleOption === 'true') {
    driver.setNetworkConditions({
      offline: false,
      latency: 50, // Additional latency (ms).
      download_throughput: 1000 * 1024, // These speeds are in bites per second, not kilobytes.
      upload_throughput: 1000 * 1024
    });
  }

  lifecycle.on('cleanup', async () => await driver.quit());

  log.info('Remote initialized');



  lifecycle.on('beforeTests', async () => {
    // hard coded default, can be overridden per suite using `remote.setWindowSize()`
    // and will be automatically reverted after each suite
    await driver.manage().window().setRect({ width: 1600, height: 1000 });
  });

  const windowSizeStack = [];
  lifecycle.on('beforeTestSuite', async () => {
    windowSizeStack.unshift(await driver.manage().window().getRect());
  });

  lifecycle.on('afterTestSuite', async () => {
    const { width, height } = windowSizeStack.shift();
    await driver.manage().window().setRect({ width: width, height: height });
  });

  const { By, until } = webdriver;

  return { driver, By, until };
}
