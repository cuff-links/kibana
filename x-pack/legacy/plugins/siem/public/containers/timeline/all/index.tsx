/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { getOr } from 'lodash/fp';
import React from 'react';
import memoizeOne from 'memoize-one';

import { OpenTimelineResult } from '../../../components/open_timeline/types';
import {
  GetAllTimeline,
  GetAllTimelineComponent,
  PageInfoTimeline,
  SortTimeline,
  TimelineResult,
} from '../../../graphql/types';

export interface AllTimelinesArgs {
  timelines: OpenTimelineResult[];
  loading: boolean;
  totalCount: number;
}

export interface AllTimelinesVariables {
  onlyUserFavorite: boolean;
  pageInfo: PageInfoTimeline;
  search: string;
  sort: SortTimeline;
}

interface OwnProps extends AllTimelinesVariables {
  children?: (args: AllTimelinesArgs) => React.ReactElement;
}

const getAllTimeline = memoizeOne(
  (variables: string, timelines: TimelineResult[]): OpenTimelineResult[] =>
    timelines.map(timeline => ({
      created: timeline.created,
      description: timeline.description,
      eventIdToNoteIds:
        timeline.eventIdToNoteIds != null
          ? timeline.eventIdToNoteIds.reduce((acc, note) => {
              if (note.eventId != null) {
                const notes = getOr([], note.eventId, acc);
                return { ...acc, [note.eventId]: [...notes, note.noteId] };
              }
              return acc;
            }, {})
          : null,
      favorite: timeline.favorite,
      noteIds: timeline.noteIds,
      notes:
        timeline.notes != null
          ? timeline.notes.map(note => ({ ...note, savedObjectId: note.noteId }))
          : null,
      pinnedEventIds:
        timeline.pinnedEventIds != null
          ? timeline.pinnedEventIds.reduce(
              (acc, pinnedEventId) => ({ ...acc, [pinnedEventId]: true }),
              {}
            )
          : null,
      savedObjectId: timeline.savedObjectId,
      title: timeline.title,
      updated: timeline.updated,
      updatedBy: timeline.updatedBy,
    }))
);

const AllTimelinesQueryComponent: React.FC<OwnProps> = ({
  children,
  onlyUserFavorite,
  pageInfo,
  search,
  sort,
}) => {
  const variables: GetAllTimeline.Variables = {
    onlyUserFavorite,
    pageInfo,
    search,
    sort,
  };
  return (
    <GetAllTimelineComponent
      fetchPolicy="network-only"
      notifyOnNetworkStatusChange
      variables={variables}
    >
      {({ data, loading }) =>
        children!({
          loading,
          totalCount: getOr(0, 'getAllTimeline.totalCount', data),
          timelines: getAllTimeline(
            JSON.stringify(variables),
            getOr([], 'getAllTimeline.timeline', data)
          ),
        })
      }
    </GetAllTimelineComponent>
  );
};

export const AllTimelinesQuery = React.memo(AllTimelinesQueryComponent);
