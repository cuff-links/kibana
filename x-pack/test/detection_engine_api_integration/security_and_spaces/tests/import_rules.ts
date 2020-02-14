/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';

import { DETECTION_ENGINE_RULES_URL } from '../../../../legacy/plugins/siem/common/constants';
import { FtrProviderContext } from '../../common/ftr_provider_context';
import {
  createSignalsIndex,
  deleteAllAlerts,
  deleteSignalsIndex,
  getSimpleRule,
  getSimpleRuleAsNdjson,
  getSimpleRuleOutput,
  removeServerGeneratedProperties,
  ruleToNdjson,
} from './utils';

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext): void => {
  const supertest = getService('supertest');
  const es = getService('legacyEs');

  describe('import_rules', () => {
    describe('importing rules', () => {
      beforeEach(async () => {
        await createSignalsIndex(supertest);
      });

      afterEach(async () => {
        await deleteSignalsIndex(supertest);
        await deleteAllAlerts(es);
      });

      it('should set the response content types to be expected', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect('Content-Type', 'application/json; charset=utf-8')
          .expect(200);
      });

      it('should reject with an error if the file type is not that of a ndjson', async () => {
        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.txt')
          .query()
          .expect(400);

        expect(body).to.eql({
          status_code: 400,
          message: 'Invalid file extension .txt',
        });
      });

      it('should report that it imported a simple rule successfully', async () => {
        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [],
          success: true,
          success_count: 1,
        });
      });

      it('should be able to read an imported rule back out correctly', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .get(`${DETECTION_ENGINE_RULES_URL}?rule_id=rule-1`)
          .send()
          .expect(200);

        const bodyToCompare = removeServerGeneratedProperties(body);
        expect(bodyToCompare).to.eql(getSimpleRuleOutput('rule-1'));
      });

      it('should be able to import two rules', async () => {
        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [],
          success: true,
          success_count: 2,
        });
      });

      it('should report a conflict if there is an attempt to import two rules with the same rule_id', async () => {
        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [], // TODO: This should have a conflict within it as an error rather than an empty array
          success: true,
          success_count: 1,
        });
      });

      it('should NOT report a conflict if there is an attempt to import two rules with the same rule_id and overwrite is set to true', async () => {
        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import?overwrite=true`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [],
          success: true,
          success_count: 1,
        });
      });

      it('should report a conflict if there is an attempt to import a rule with a rule_id that already exists', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [
            {
              error: {
                message: 'rule_id: "rule-1" already exists',
                status_code: 409,
              },
              rule_id: 'rule-1',
            },
          ],
          success: false,
          success_count: 0,
        });
      });

      it('should NOT report a conflict if there is an attempt to import a rule with a rule_id that already exists and overwrite is set to true', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import?overwrite=true`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import?overwrite=true`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [],
          success: true,
          success_count: 1,
        });
      });

      it('should overwrite an existing rule if overwrite is set to true', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        const simpleRule = getSimpleRule('rule-1');
        simpleRule.name = 'some other name';
        const ndjson = ruleToNdjson(simpleRule);

        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import?overwrite=true`)
          .set('kbn-xsrf', 'true')
          .attach('file', ndjson, 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .get(`${DETECTION_ENGINE_RULES_URL}?rule_id=rule-1`)
          .send()
          .expect(200);

        const bodyToCompare = removeServerGeneratedProperties(body);
        const ruleOutput = getSimpleRuleOutput('rule-1');
        ruleOutput.name = 'some other name';
        ruleOutput.version = 2;
        expect(bodyToCompare).to.eql(ruleOutput);
      });

      it('should report a conflict if there is an attempt to import a rule with a rule_id that already exists, but still have some successes with other rules', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2', 'rule-3']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [
            {
              error: {
                message: 'rule_id: "rule-1" already exists',
                status_code: 409,
              },
              rule_id: 'rule-1',
            },
          ],
          success: false,
          success_count: 2,
        });
      });

      it('should report a mix of conflicts and a mix of successes', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body } = await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2', 'rule-3']), 'rules.ndjson')
          .query()
          .expect(200);

        expect(body).to.eql({
          errors: [
            {
              error: {
                message: 'rule_id: "rule-1" already exists',
                status_code: 409,
              },
              rule_id: 'rule-1',
            },
            {
              error: {
                message: 'rule_id: "rule-2" already exists',
                status_code: 409,
              },
              rule_id: 'rule-2',
            },
          ],
          success: false,
          success_count: 1,
        });
      });

      it('should be able to correctly read back a mixed import of different rules even if some cause conflicts', async () => {
        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2']), 'rules.ndjson')
          .query()
          .expect(200);

        await supertest
          .post(`${DETECTION_ENGINE_RULES_URL}/_import`)
          .set('kbn-xsrf', 'true')
          .attach('file', getSimpleRuleAsNdjson(['rule-1', 'rule-2', 'rule-3']), 'rules.ndjson')
          .query()
          .expect(200);

        const { body: bodyOfRule1 } = await supertest
          .get(`${DETECTION_ENGINE_RULES_URL}?rule_id=rule-1`)
          .send()
          .expect(200);

        const { body: bodyOfRule2 } = await supertest
          .get(`${DETECTION_ENGINE_RULES_URL}?rule_id=rule-2`)
          .send()
          .expect(200);

        const { body: bodyOfRule3 } = await supertest
          .get(`${DETECTION_ENGINE_RULES_URL}?rule_id=rule-3`)
          .send()
          .expect(200);

        const bodyToCompareOfRule1 = removeServerGeneratedProperties(bodyOfRule1);
        const bodyToCompareOfRule2 = removeServerGeneratedProperties(bodyOfRule2);
        const bodyToCompareOfRule3 = removeServerGeneratedProperties(bodyOfRule3);

        expect([bodyToCompareOfRule1, bodyToCompareOfRule2, bodyToCompareOfRule3]).to.eql([
          getSimpleRuleOutput('rule-1'),
          getSimpleRuleOutput('rule-2'),
          getSimpleRuleOutput('rule-3'),
        ]);
      });
    });
  });
};
