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

import { modifyUrl } from '../../../src/core/utils';
import { WebElementWrapper } from './lib/web_element_wrapper';

export async function BrowserProvider({ getService }) {
  const { driver, Key } = await getService('__webdriver__').init();

  return new class BrowserService {
    getKeys() {
      return Key;
    }

    /**
     * Retrieves the a rect describing the current top-level window's size and position.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_Window.html
     *
     * @return {Promise<{height: number, width: number, x: number, y: number}>}
     */
    async getWindowSize() {
      return await driver.manage().window().getRect();
    }


    /**
     * Sets the dimensions of a window.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_Window.html
     *
     * @param {number} width
     * @param {number} height
     * @return {Promise<void>}
     */
    async setWindowSize(...args) {
      await driver.manage().window().setRect({ width: args[0], height: args[1] });
    }

    /**
     * Gets the URL that is loaded in the focused window/frame.
     * https://theintern.io/leadfoot/module-leadfoot_Session.html#getCurrentUrl
     *
     * @return {Promise<string>}
     */
    async getCurrentUrl() {
      // strip _t=Date query param when url is read
      const current = await driver.getCurrentUrl();
      const currentWithoutTime = modifyUrl(current, parsed => {
        delete parsed.query._t;
      });
      return currentWithoutTime;
    }

    /**
     * Navigates the focused window/frame to a new URL.
     * https://theintern.io/leadfoot/module-leadfoot_Session.html#get
     *
     * @param {string} url
     * @param {boolean} insertTimestamp Optional
     * @return {Promise<void>}
     */
    async get(url, insertTimestamp = true) {
      if (insertTimestamp) {
        const urlWithTime = modifyUrl(url, parsed => {
          parsed.query._t = Date.now();
        });

        return await driver.get(urlWithTime);
      }
      return await driver.get(url);
    }

    /**
     * Moves the remote environment’s mouse cursor to the specified element or relative
     * position.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/input_exports_Actions.html#move
     *
     * @param {WebElementWrapper} element Optional
     * @param {number} xOffset Optional
     * @param {number} yOffset Optional
     * @return {Promise<void>}
     */
    async moveMouseTo(element, xOffset, yOffset) {
      const mouse = driver.actions().mouse();
      const actions = driver.actions({ bridge: true });
      if (element instanceof WebElementWrapper) {
        await actions.pause(mouse).move({ origin: element._webElement }).perform();
      } else if (isNaN(xOffset) || isNaN(yOffset) === false) {
        await actions.pause(mouse).move({ origin: { x: xOffset, y: yOffset } }).perform();
      } else {
        throw new Error('Element or coordinates should be provided');
      }
    }

    /**
     * Does a drag-and-drop action from one point to another
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/input_exports_Actions.html#dragAndDrop
     *
     * @param {{element: WebElementWrapper} from
     * @param {{element: WebElementWrapper, xOffset: number, yOffset: number}} to
     * @return {Promise<void>}
     */
    async dragAndDrop(from, to) {
      const actions = driver.actions({ bridge: true });
      //let _to = { x: 0, y: 0 };
      const _from = from.element._webElement;
      const _to = to.element._webElement;

      // if (to.element) {
      //   const position = await to.element.getPosition();
      //   _to = { x: position.x, y: position.y };
      // }
      //const _toWithOffset = { x: _to.x + (to.xOffset || 0),  y: _to.y + (to.yOffset || 0) };

      await actions.dragAndDrop(_from, _to).perform();
    }

    /**
     * Reloads the current browser window/frame.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_Navigation.html#refresh
     *
     * @return {Promise<void>}
     */
    async refresh() {
      await driver.navigate().refresh();
    }

    /**
     * Navigates the focused window/frame back one page using the browser’s navigation history.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_Navigation.html#back
     *
     * @return {Promise<void>}
     */
    async goBack() {
      await driver.navigate().back();
    }

    /**
     * Sends a sequance of keyboard keys. For each key, this will record a pair of keyDown and keyUp actions
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/input_exports_Actions.html#sendKeys
     *
     * @param  {string|string[]} keys
     * @return {Promise<void>}
     */
    async pressKeys(...args) {
      const actions = driver.actions({ bridge: true });
      const chord = this.getKeys().chord(...args);
      await actions.sendKeys(chord).perform();
    }

    /**
     * Inserts an action for moving the mouse x and y pixels relative to the specified origin.
     * The origin may be defined as the mouse's current position, the viewport, or the center
     * of a specific WebElement. Then adds an action for left-click (down/up) with the mouse.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/input_exports_Actions.html#click
     *
     * @param {WebElementWrapper} element Optional
     * @param {number} xOffset Optional
     * @param {number} yOffset Optional
     * @return {Promise<void>}
     */
    async clickMouseButton(...args) {
      const mouse = driver.actions().mouse();
      const actions = driver.actions({ bridge: true });
      if (args[0] instanceof WebElementWrapper) {
        await actions.pause(mouse).move({ origin: args[0]._webElement }).click().perform();
      } else if (isNaN(args[1]) || isNaN(args[2]) === false) {
        await actions.pause(mouse).move({ origin: { x: args[1], y: args[2] } }).click().perform();
      } else {
        throw new Error('Element or coordinates should be provided');
      }
    }

    /**
     * Gets the HTML loaded in the focused window/frame. This markup is serialised by the remote
     * environment so may not exactly match the HTML provided by the Web server.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_WebDriver.html#getPageSource
     *
     * @return {Promise<string>}
     */
    async getPageSource() {
      return await driver.getPageSource();
    }

    /**
     * Gets all logs from the remote environment of the given type. The logs in the remote
     * environment are cleared once they have been retrieved.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_Logs.html#get
     *
     * @param {!logging.Type} type The desired log type.
     * @return {Promise<LogEntry[]>}
     */
    async getLogsFor(...args) {
      return await driver.manage().logs().get(...args);
    }

    /**
     * Gets a screenshot of the focused window and returns it as a base-64 encoded PNG
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_WebDriver.html#takeScreenshot
     *
     * @return {Promise<Buffer>}
     */
    async takeScreenshot() {
      return await driver.takeScreenshot();
    }

    /**
     * Inserts action for performing a double left-click with the mouse.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/input_exports_Actions.html#doubleClick
     * @param {WebElementWrapper} element
     * @return {Promise<void>}
     */
    async doubleClick(element) {
      const actions = driver.actions({ bridge: true });
      if (element instanceof WebElementWrapper) {
        await actions.doubleClick(element._webElement).perform();
      } else {
        await actions.doubleClick().perform();
      }
    }

    /**
     * Changes the focus of all future commands to another window. Windows may be specified
     * by their window.name attributeor by its handle (as returned by WebDriver#getWindowHandles).
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_TargetLocator.html
     *
     * @param {string} handle
     * @return {Promise<void>}
     */
    async switchToWindow(...args) {
      await driver.switchTo().window(...args);
    }

    /**
     * Gets a list of identifiers for all currently open windows.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_WebDriver.html#getAllWindowHandles
     *
     * @return {Promise<string[]>}
     */
    async getAllWindowHandles() {
      return await driver.getAllWindowHandles();
    }

    /**
     * Closes the currently focused window. In most environments, after the window has been
     * closed, it is necessary to explicitly switch to whatever window is now focused.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_WebDriver.html#close
     *
     * @return {Promise<void>}
     */
    async closeCurrentWindow() {
      await driver.close();
    }

    /**
     * Executes JavaScript code within the focused window/frame. The code should return a value synchronously.
     * https://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/lib/webdriver_exports_WebDriver.html#executeScript
     *
     * @param  {string|function} function
     * @param  {...any[]} args
     */
    async execute(...args) {
      return await driver.executeScript(...args);
    }
  };
}
