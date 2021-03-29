/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from 'react-dom/test-utils';
import { setup, SetupResult, getProcessorValue } from './processor.helpers';

// Default parameter values automatically added to the URI parts processor when saved
const defaultAppendParameters = {
  if: undefined,
  tag: undefined,
  ignore_failure: undefined,
  description: undefined,
};

const APPEND_TYPE = 'append';

describe('Processor: Append', () => {
  let onUpdate: jest.Mock;
  let testBed: SetupResult;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    onUpdate = jest.fn();

    await act(async () => {
      testBed = await setup({
        value: {
          processors: [],
        },
        onFlyoutOpen: jest.fn(),
        onUpdate,
      });
    });
    testBed.component.update();
  });

  test('prevents form submission if required fields are not provided', async () => {
    const {
      actions: { addProcessor, saveNewProcessor, addProcessorType },
      form,
    } = testBed;

    // Open flyout to add new processor
    addProcessor();

    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(APPEND_TYPE);

    // Click submit button with only the type defined
    await saveNewProcessor();

    // Expect form error as "field" is required parameter
    expect(form.getErrorsMessages()).toEqual([
      'A field value is required.',
      'A value is required.',
    ]);
  });

  test('saves with default parameter values', async () => {
    const {
      actions: { addProcessor, saveNewProcessor, addProcessorType },
      form,
      find,
    } = testBed;

    // Open flyout to add new processor
    addProcessor();
    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(APPEND_TYPE);
    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    find('valueFieldAppend.input').simulate('change', [{ label: 'Some_Value' }]);

    // Save the field
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0].append).toEqual({
      field: 'field_1',
      value: ['Some_Value'],
      ...defaultAppendParameters,
    });
  });

  test('allows optional parameters to be set', async () => {
    const {
      actions: { addProcessor, addProcessorType, saveNewProcessor },
      form,
      find,
    } = testBed;

    // Open flyout to add new processor
    addProcessor();
    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(APPEND_TYPE);
    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    // Set optional parameteres
    find('valueFieldAppend.input').simulate('change', [{ label: 'Some_Value' }]);

    form.toggleEuiSwitch('ignoreFailureSwitch.input');
    // Save the field with new changes
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0].append).toEqual({
      description: undefined,
      field: 'field_1',
      ignore_failure: true,
      if: undefined,
      tag: undefined,
      value: ['Some_Value'],
    });
  });
});
