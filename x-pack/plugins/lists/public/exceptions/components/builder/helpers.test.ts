/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  fields,
  getField,
} from '../../../../../../../src/plugins/data/common/index_patterns/fields/fields.mocks';
import { IFieldType, IIndexPattern } from '../../../../../../../src/plugins/data/common';
import { getEntryNestedMock } from '../../../../common/schemas/types/entry_nested.mock';
import { getEntryMatchMock } from '../../../../common/schemas/types/entry_match.mock';
import { getEntryMatchAnyMock } from '../../../../common/schemas/types/entry_match_any.mock';
import { getListResponseMock } from '../../../../common/schemas/response/list_schema.mock';
import {
  EXCEPTION_OPERATORS,
  EXCEPTION_OPERATORS_SANS_LISTS,
  doesNotExistOperator,
  existsOperator,
  isInListOperator,
  isNotOneOfOperator,
  isNotOperator,
  isOneOfOperator,
  isOperator,
} from '../autocomplete/operators';
import {
  EntryExists,
  EntryList,
  EntryMatch,
  EntryMatchAny,
  EntryNested,
  ExceptionListType,
  OperatorEnum,
  OperatorTypeEnum,
} from '../../../../common';
import { OperatorOption } from '../autocomplete/types';

import { BuilderEntry, FormattedBuilderEntry } from './types';
import {
  getEntryFromOperator,
  getEntryOnFieldChange,
  getEntryOnListChange,
  getEntryOnMatchAnyChange,
  getEntryOnMatchChange,
  getEntryOnOperatorChange,
  getFilteredIndexPatterns,
  getOperatorOptions,
} from './helpers';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('123'),
}));

const getEntryNestedWithIdMock = (): EntryNested & { id: string } => ({
  ...getEntryNestedMock(),
  id: '123',
});

const getEntryMatchWithIdMock = (): EntryMatch & { id: string } => ({
  ...getEntryMatchMock(),
  id: '123',
});

const getEntryMatchAnyWithIdMock = (): EntryMatchAny & { id: string } => ({
  ...getEntryMatchAnyMock(),
  id: '123',
});

const getMockIndexPattern = (): IIndexPattern => ({
  fields,
  id: '1234',
  title: 'logstash-*',
});

const getMockBuilderEntry = (): FormattedBuilderEntry => ({
  correspondingKeywordField: undefined,
  entryIndex: 0,
  field: getField('ip'),
  id: '123',
  nested: undefined,
  operator: isOperator,
  parent: undefined,
  value: 'some value',
});

const getMockNestedBuilderEntry = (): FormattedBuilderEntry => ({
  correspondingKeywordField: undefined,
  entryIndex: 0,
  field: getField('nestedField.child'),
  id: '123',
  nested: 'child',
  operator: isOperator,
  parent: {
    parent: {
      ...getEntryNestedWithIdMock(),
      entries: [{ ...getEntryMatchWithIdMock(), field: 'child' }],
      field: 'nestedField',
    },
    parentIndex: 0,
  },
  value: 'some value',
});

const getMockNestedParentBuilderEntry = (): FormattedBuilderEntry => ({
  correspondingKeywordField: undefined,
  entryIndex: 0,
  field: { ...getField('nestedField.child'), esTypes: ['nested'], name: 'nestedField' },
  id: '123',
  nested: 'parent',
  operator: isOperator,
  parent: undefined,
  value: undefined,
});

const mockEndpointFields = [
  {
    aggregatable: false,
    count: 0,
    esTypes: ['keyword'],
    name: 'file.path.caseless',
    readFromDocValues: false,
    scripted: false,
    searchable: true,
    type: 'string',
  },
  {
    aggregatable: false,
    count: 0,
    esTypes: ['text'],
    name: 'file.Ext.code_signature.status',
    readFromDocValues: false,
    scripted: false,
    searchable: true,
    subType: { nested: { path: 'file.Ext.code_signature' } },
    type: 'string',
  },
];

export const getEndpointField = (name: string): IFieldType =>
  mockEndpointFields.find((field) => field.name === name) as IFieldType;

const filterIndexPatterns = (patterns: IIndexPattern, type: ExceptionListType): IIndexPattern => {
  return type === 'endpoint'
    ? {
        ...patterns,
        fields: patterns.fields.filter(({ name }) =>
          ['file.path.caseless', 'file.Ext.code_signature.status'].includes(name)
        ),
      }
    : patterns;
};

describe('Exception builder helpers', () => {
  describe('#getFilteredIndexPatterns', () => {
    describe('list type detections', () => {
      test('it returns nested fields that match parent value when "item.nested" is "child"', () => {
        const payloadIndexPattern: IIndexPattern = getMockIndexPattern();
        const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'detection');
        const expected: IIndexPattern = {
          fields: [{ ...getField('nestedField.child'), name: 'child' }],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns only parent nested field when "item.nested" is "parent" and nested parent field is not undefined', () => {
        const payloadIndexPattern: IIndexPattern = getMockIndexPattern();
        const payloadItem: FormattedBuilderEntry = getMockNestedParentBuilderEntry();
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'detection');
        const expected: IIndexPattern = {
          fields: [{ ...getField('nestedField.child'), esTypes: ['nested'], name: 'nestedField' }],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns only nested fields when "item.nested" is "parent" and nested parent field is undefined', () => {
        const payloadIndexPattern: IIndexPattern = getMockIndexPattern();
        const payloadItem: FormattedBuilderEntry = {
          ...getMockNestedParentBuilderEntry(),
          field: undefined,
        };
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'detection');
        const expected: IIndexPattern = {
          fields: [
            { ...getField('nestedField.child') },
            { ...getField('nestedField.nestedChild.doublyNestedChild') },
          ],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns all fields unfiletered if "item.nested" is not "child" or "parent"', () => {
        const payloadIndexPattern: IIndexPattern = getMockIndexPattern();
        const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'detection');
        const expected: IIndexPattern = {
          fields: [...fields],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });
    });

    describe('list type endpoint', () => {
      let payloadIndexPattern: IIndexPattern = getMockIndexPattern();

      beforeAll(() => {
        payloadIndexPattern = {
          ...payloadIndexPattern,
          fields: [...payloadIndexPattern.fields, ...mockEndpointFields],
        };
      });

      test('it returns nested fields that match parent value when "item.nested" is "child"', () => {
        const payloadItem: FormattedBuilderEntry = {
          correspondingKeywordField: undefined,
          entryIndex: 0,
          field: getEndpointField('file.Ext.code_signature.status'),
          id: '123',
          nested: 'child',
          operator: isOperator,
          parent: {
            parent: {
              ...getEntryNestedWithIdMock(),
              entries: [{ ...getEntryMatchWithIdMock(), field: 'child' }],
              field: 'file.Ext.code_signature',
            },
            parentIndex: 0,
          },
          value: 'some value',
        };
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'endpoint');
        const expected: IIndexPattern = {
          fields: [{ ...getEndpointField('file.Ext.code_signature.status'), name: 'status' }],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns only parent nested field when "item.nested" is "parent" and nested parent field is not undefined', () => {
        const payloadItem: FormattedBuilderEntry = {
          ...getMockNestedParentBuilderEntry(),
          field: {
            ...getEndpointField('file.Ext.code_signature.status'),
            esTypes: ['nested'],
            name: 'file.Ext.code_signature',
          },
        };
        const output = getFilteredIndexPatterns(payloadIndexPattern, payloadItem, 'endpoint');
        const expected: IIndexPattern = {
          fields: [
            {
              aggregatable: false,
              count: 0,
              esTypes: ['nested'],
              name: 'file.Ext.code_signature',
              readFromDocValues: false,
              scripted: false,
              searchable: true,
              subType: {
                nested: {
                  path: 'file.Ext.code_signature',
                },
              },
              type: 'string',
            },
          ],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns only nested fields when "item.nested" is "parent" and nested parent field is undefined', () => {
        const payloadItem: FormattedBuilderEntry = {
          ...getMockNestedParentBuilderEntry(),
          field: undefined,
        };
        const output = getFilteredIndexPatterns(
          payloadIndexPattern,
          payloadItem,
          'endpoint',
          filterIndexPatterns
        );
        const expected: IIndexPattern = {
          fields: [getEndpointField('file.Ext.code_signature.status')],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });

      test('it returns all fields that matched those in "exceptionable_fields.json" with no further filtering if "item.nested" is not "child" or "parent"', () => {
        const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
        const output = getFilteredIndexPatterns(
          payloadIndexPattern,
          payloadItem,
          'endpoint',
          filterIndexPatterns
        );
        const expected: IIndexPattern = {
          fields: [
            {
              aggregatable: false,
              count: 0,
              esTypes: ['keyword'],
              name: 'file.path.caseless',
              readFromDocValues: false,
              scripted: false,
              searchable: true,
              type: 'string',
            },
            {
              aggregatable: false,
              count: 0,
              esTypes: ['text'],
              name: 'file.Ext.code_signature.status',
              readFromDocValues: false,
              scripted: false,
              searchable: true,
              subType: { nested: { path: 'file.Ext.code_signature' } },
              type: 'string',
            },
          ],
          id: '1234',
          title: 'logstash-*',
        };
        expect(output).toEqual(expected);
      });
    });
  });

  describe('#getEntryFromOperator', () => {
    test('it returns current value when switching from "is" to "is not"', () => {
      const payloadOperator: OperatorOption = isNotOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        value: 'I should stay the same',
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatch & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: 'excluded',
        type: OperatorTypeEnum.MATCH,
        value: 'I should stay the same',
      };
      expect(output).toEqual(expected);
    });

    test('it returns current value when switching from "is not" to "is"', () => {
      const payloadOperator: OperatorOption = isOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isNotOperator,
        value: 'I should stay the same',
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatch & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: OperatorTypeEnum.MATCH,
        value: 'I should stay the same',
      };
      expect(output).toEqual(expected);
    });

    test('it returns empty value when switching operator types to "match"', () => {
      const payloadOperator: OperatorOption = isOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isNotOneOfOperator,
        value: ['I should stay the same'],
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatch & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: OperatorTypeEnum.MATCH,
        value: '',
      };
      expect(output).toEqual(expected);
    });

    test('it returns current value when switching from "is one of" to "is not one of"', () => {
      const payloadOperator: OperatorOption = isNotOneOfOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOneOfOperator,
        value: ['I should stay the same'],
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatchAny & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: 'excluded',
        type: OperatorTypeEnum.MATCH_ANY,
        value: ['I should stay the same'],
      };
      expect(output).toEqual(expected);
    });

    test('it returns current value when switching from "is not one of" to "is one of"', () => {
      const payloadOperator: OperatorOption = isOneOfOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isNotOneOfOperator,
        value: ['I should stay the same'],
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatchAny & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: OperatorTypeEnum.MATCH_ANY,
        value: ['I should stay the same'],
      };
      expect(output).toEqual(expected);
    });

    test('it returns empty value when switching operator types to "match_any"', () => {
      const payloadOperator: OperatorOption = isOneOfOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOperator,
        value: 'I should stay the same',
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryMatchAny & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: OperatorTypeEnum.MATCH_ANY,
        value: [],
      };
      expect(output).toEqual(expected);
    });

    test('it returns current value when switching from "exists" to "does not exist"', () => {
      const payloadOperator: OperatorOption = doesNotExistOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: existsOperator,
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryExists & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: 'excluded',
        type: 'exists',
      };
      expect(output).toEqual(expected);
    });

    test('it returns current value when switching from "does not exist" to "exists"', () => {
      const payloadOperator: OperatorOption = existsOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: doesNotExistOperator,
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryExists & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: 'exists',
      };
      expect(output).toEqual(expected);
    });

    test('it returns empty value when switching operator types to "exists"', () => {
      const payloadOperator: OperatorOption = existsOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOperator,
        value: 'I should stay the same',
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryExists & { id?: string } = {
        field: 'ip',
        id: '123',
        operator: OperatorEnum.INCLUDED,
        type: 'exists',
      };
      expect(output).toEqual(expected);
    });

    test('it returns empty value when switching operator types to "list"', () => {
      const payloadOperator: OperatorOption = isInListOperator;
      const payloadEntry: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOperator,
        value: 'I should stay the same',
      };
      const output = getEntryFromOperator(payloadOperator, payloadEntry);
      const expected: EntryList & { id?: string } = {
        field: 'ip',
        id: '123',
        list: { id: '', type: 'ip' },
        operator: OperatorEnum.INCLUDED,
        type: 'list',
      };
      expect(output).toEqual(expected);
    });
  });

  describe('#getOperatorOptions', () => {
    test('it returns "isOperator" when field type is nested but field itself has not yet been selected', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedParentBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'endpoint', false);
      const expected: OperatorOption[] = [isOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator" if no field selected', () => {
      const payloadItem: FormattedBuilderEntry = { ...getMockBuilderEntry(), field: undefined };
      const output = getOperatorOptions(payloadItem, 'endpoint', false);
      const expected: OperatorOption[] = [isOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator" and "isOneOfOperator" if item is nested and "listType" is "endpoint"', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'endpoint', false);
      const expected: OperatorOption[] = [isOperator, isOneOfOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator" and "isOneOfOperator" if "listType" is "endpoint"', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'endpoint', false);
      const expected: OperatorOption[] = [isOperator, isOneOfOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator" if "listType" is "endpoint" and field type is boolean', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'endpoint', true);
      const expected: OperatorOption[] = [isOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator", "isOneOfOperator", and "existsOperator" if item is nested and "listType" is "detection"', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', false);
      const expected: OperatorOption[] = [isOperator, isOneOfOperator, existsOperator];
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator" and "existsOperator" if item is nested, "listType" is "detection", and field type is boolean', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', true);
      const expected: OperatorOption[] = [isOperator, existsOperator];
      expect(output).toEqual(expected);
    });

    test('it returns all operator options if "listType" is "detection"', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', false);
      const expected: OperatorOption[] = EXCEPTION_OPERATORS;
      expect(output).toEqual(expected);
    });

    test('it returns "isOperator", "isNotOperator", "doesNotExistOperator" and "existsOperator" if field type is boolean', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', true);
      const expected: OperatorOption[] = [
        isOperator,
        isNotOperator,
        existsOperator,
        doesNotExistOperator,
      ];
      expect(output).toEqual(expected);
    });

    test('it returns list operators if specified to', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', false, true);
      expect(output).toEqual(EXCEPTION_OPERATORS);
    });

    test('it does not return list operators if specified not to', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getOperatorOptions(payloadItem, 'detection', false, false);
      expect(output).toEqual(EXCEPTION_OPERATORS_SANS_LISTS);
    });
  });

  describe('#getEntryOnFieldChange', () => {
    test('it returns nested entry with single new subentry when "item.nested" is "parent"', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedParentBuilderEntry();
      const payloadIFieldType: IFieldType = getField('nestedField.child');
      const output = getEntryOnFieldChange(payloadItem, payloadIFieldType);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH,
              value: '',
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns nested entry with newly selected field value when "item.nested" is "child"', () => {
      const payloadItem: FormattedBuilderEntry = {
        ...getMockNestedBuilderEntry(),
        parent: {
          parent: {
            ...getEntryNestedWithIdMock(),
            entries: [
              { ...getEntryMatchWithIdMock(), field: 'child' },
              getEntryMatchAnyWithIdMock(),
            ],
            field: 'nestedField',
          },
          parentIndex: 0,
        },
      };
      const payloadIFieldType: IFieldType = getField('nestedField.child');
      const output = getEntryOnFieldChange(payloadItem, payloadIFieldType);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH,
              value: '',
            },
            getEntryMatchAnyWithIdMock(),
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns field of type "match" with updated field if not a nested entry', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const payloadIFieldType: IFieldType = getField('ip');
      const output = getEntryOnFieldChange(payloadItem, payloadIFieldType);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH,
          value: '',
        },
      };
      expect(output).toEqual(expected);
    });
  });

  describe('#getEntryOnOperatorChange', () => {
    test('it returns updated subentry preserving its value when entry is not switching operator types', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const payloadOperator: OperatorOption = isNotOperator;
      const output = getEntryOnOperatorChange(payloadItem, payloadOperator);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          operator: 'excluded',
          type: OperatorTypeEnum.MATCH,
          value: 'some value',
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns updated subentry resetting its value when entry is switching operator types', () => {
      const payloadItem: FormattedBuilderEntry = getMockBuilderEntry();
      const payloadOperator: OperatorOption = isOneOfOperator;
      const output = getEntryOnOperatorChange(payloadItem, payloadOperator);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH_ANY,
          value: [],
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns updated subentry preserving its value when entry is nested and not switching operator types', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const payloadOperator: OperatorOption = isNotOperator;
      const output = getEntryOnOperatorChange(payloadItem, payloadOperator);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.EXCLUDED,
              type: OperatorTypeEnum.MATCH,
              value: 'some value',
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns updated subentry resetting its value when entry is nested and switching operator types', () => {
      const payloadItem: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const payloadOperator: OperatorOption = isOneOfOperator;
      const output = getEntryOnOperatorChange(payloadItem, payloadOperator);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH_ANY,
              value: [],
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });
  });

  describe('#getEntryOnMatchChange', () => {
    test('it returns entry with updated value', () => {
      const payload: FormattedBuilderEntry = getMockBuilderEntry();
      const output = getEntryOnMatchChange(payload, 'jibber jabber');
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH,
          value: 'jibber jabber',
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns entry with updated value and "field" of empty string if entry does not have a "field" defined', () => {
      const payload: FormattedBuilderEntry = { ...getMockBuilderEntry(), field: undefined };
      const output = getEntryOnMatchChange(payload, 'jibber jabber');
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: '',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH,
          value: 'jibber jabber',
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns nested entry with updated value', () => {
      const payload: FormattedBuilderEntry = getMockNestedBuilderEntry();
      const output = getEntryOnMatchChange(payload, 'jibber jabber');
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH,
              value: 'jibber jabber',
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns nested entry with updated value and "field" of empty string if entry does not have a "field" defined', () => {
      const payload: FormattedBuilderEntry = { ...getMockNestedBuilderEntry(), field: undefined };
      const output = getEntryOnMatchChange(payload, 'jibber jabber');
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: '',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH,
              value: 'jibber jabber',
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });
  });

  describe('#getEntryOnMatchAnyChange', () => {
    test('it returns entry with updated value', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOneOfOperator,
        value: ['some value'],
      };
      const output = getEntryOnMatchAnyChange(payload, ['jibber jabber']);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH_ANY,
          value: ['jibber jabber'],
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns entry with updated value and "field" of empty string if entry does not have a "field" defined', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        field: undefined,
        operator: isOneOfOperator,
        value: ['some value'],
      };
      const output = getEntryOnMatchAnyChange(payload, ['jibber jabber']);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: '',
          id: '123',
          operator: OperatorEnum.INCLUDED,
          type: OperatorTypeEnum.MATCH_ANY,
          value: ['jibber jabber'],
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns nested entry with updated value', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockNestedBuilderEntry(),
        parent: {
          parent: {
            ...getEntryNestedWithIdMock(),
            entries: [{ ...getEntryMatchAnyWithIdMock(), field: 'child' }],
            field: 'nestedField',
          },
          parentIndex: 0,
        },
      };
      const output = getEntryOnMatchAnyChange(payload, ['jibber jabber']);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: 'child',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH_ANY,
              value: ['jibber jabber'],
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns nested entry with updated value and "field" of empty string if entry does not have a "field" defined', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockNestedBuilderEntry(),
        field: undefined,
        parent: {
          parent: {
            ...getEntryNestedWithIdMock(),
            entries: [{ ...getEntryMatchAnyWithIdMock(), field: 'child' }],
            field: 'nestedField',
          },
          parentIndex: 0,
        },
      };
      const output = getEntryOnMatchAnyChange(payload, ['jibber jabber']);
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          entries: [
            {
              field: '',
              id: '123',
              operator: OperatorEnum.INCLUDED,
              type: OperatorTypeEnum.MATCH_ANY,
              value: ['jibber jabber'],
            },
          ],
          field: 'nestedField',
          id: '123',
          type: OperatorTypeEnum.NESTED,
        },
      };
      expect(output).toEqual(expected);
    });
  });

  describe('#getEntryOnListChange', () => {
    test('it returns entry with updated value', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        operator: isOneOfOperator,
        value: '1234',
      };
      const output = getEntryOnListChange(payload, getListResponseMock());
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: 'ip',
          id: '123',
          list: { id: 'some-list-id', type: 'ip' },
          operator: OperatorEnum.INCLUDED,
          type: 'list',
        },
      };
      expect(output).toEqual(expected);
    });

    test('it returns entry with updated value and "field" of empty string if entry does not have a "field" defined', () => {
      const payload: FormattedBuilderEntry = {
        ...getMockBuilderEntry(),
        field: undefined,
        operator: isOneOfOperator,
        value: '1234',
      };
      const output = getEntryOnListChange(payload, getListResponseMock());
      const expected: { updatedEntry: BuilderEntry & { id?: string }; index: number } = {
        index: 0,
        updatedEntry: {
          field: '',
          id: '123',
          list: { id: 'some-list-id', type: 'ip' },
          operator: OperatorEnum.INCLUDED,
          type: 'list',
        },
      };
      expect(output).toEqual(expected);
    });
  });
});
