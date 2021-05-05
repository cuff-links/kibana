/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from 'react-dom/test-utils';
import { setup, SetupResult, getProcessorValue } from './processor.helpers';

// Default parameter values automatically added to the Bytes processor when saved

const BYTES_TYPE = 'bytes';

describe('Processor: Bytes', () => {
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
    // Click submit button without entering any fields
    await saveNewProcessor();

    // Expect form error as a processor type is required
    expect(form.getErrorsMessages()).toEqual(['A type is required.']);

    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(BYTES_TYPE);

    // Click submit button with only the type defined
    await saveNewProcessor();

    // Expect form error as "field" is required parameter
    expect(form.getErrorsMessages()).toEqual(['A field value is required.']);
  });

  test('saves with default parameter values', async () => {
    const {
      actions: { addProcessor, saveNewProcessor, addProcessorType },
      form,
    } = testBed;

    // Open flyout to add new processor
    addProcessor();
    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(BYTES_TYPE);
    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');
    // Save the field
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, BYTES_TYPE);
    expect(processors[0].bytes).toEqual({
      field: 'field_1',
    });
  });

  test('saves with common fields set', async () => {
    const {
      actions: { addProcessor, saveNewProcessor, addProcessorType },
      form,
      find,
    } = testBed;

    // This test ensures that the common fields that are used across all processors
    // works and removes the need for those fields to be in every processors' test.

    // Open flyout to add new processor
    addProcessor();
    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(BYTES_TYPE);
    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    form.toggleEuiSwitch('ignoreFailureSwitch.input');

    form.setInputValue('targetField.input', 'target_field');

    form.setInputValue('tagField.input', 'some_tag');

    // Trying to get the monaco text editor to work with CITs.
    const jsonContent = JSON.stringify({ content: "ctx?.network?.name == 'Guest'" });
    await find('mockCodeEditor').simulate('change', { jsonContent });

    // Save the field
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, BYTES_TYPE);
    expect(processors[0].bytes).toEqual({
      field: 'field_1',
      ignore_failure: true,
      if: jsonContent,
      tag: 'some_tag',
      ignore_missing: undefined,
      target_field: 'target_field',
    });
  });

  test('allows optional parameters to be set', async () => {
    const {
      actions: { addProcessor, addProcessorType, saveNewProcessor },
      form,
    } = testBed;

    // Open flyout to add new processor
    addProcessor();
    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(BYTES_TYPE);
    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    // Set optional parameteres
    form.setInputValue('targetField.input', 'target_field');

    form.toggleEuiSwitch('ignoreMissingSwitch.input');

    // Save the field with new changes
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, BYTES_TYPE);
    expect(processors[0].bytes).toEqual({
      field: 'field_1',
      target_field: 'target_field',
      ignore_missing: true,
    });
  });
});
