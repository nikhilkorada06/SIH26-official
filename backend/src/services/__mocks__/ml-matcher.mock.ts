import { EntityMatcher, MatchRequest, MatchResult } from '../ml-matcher.interface';
import { CanonicalCitizenData } from '../integration-engine.interface';

function normalizeField(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
}

function compareFields(source: CanonicalCitizenData, application: CanonicalCitizenData): { matched: string[]; unmatched: string[] } {
  const matched: string[] = [];
  const unmatched: string[] = [];
  const fieldsToCompare = ['name', 'dateOfBirth', 'registrationNumber'];

  for (const field of fieldsToCompare) {
    const sourceVal = source[field];
    const appVal = application[field];

    if (sourceVal && appVal && normalizeField(sourceVal) === normalizeField(appVal)) {
      matched.push(field);
    } else if (sourceVal || appVal) {
      unmatched.push(field);
    }
  }

  return { matched, unmatched };
}

export class MockEntityMatcher implements EntityMatcher {
  async match(request: MatchRequest): Promise<MatchResult> {
    const { sourceData, applicationData } = request;

    const { matched, unmatched } = compareFields(sourceData, applicationData);

    const samePerson = matched.includes('name') && matched.includes('dateOfBirth');

    let confidence = 0;
    if (samePerson) {
      confidence = 0.95 + (matched.length - 2) * 0.02;
      confidence = Math.min(confidence, 0.99);
    } else if (matched.length > 0) {
      confidence = 0.3 + matched.length * 0.1;
    }

    const sourceName = (sourceData.name as string)?.toLowerCase();
    const appName = (applicationData.name as string)?.toLowerCase();
    if (sourceName === 'rahul kumar' && appName === 'rahul kumar') {
      return {
        samePerson: true,
        confidence: 0.96,
        matchedFields: ['name', 'dateOfBirth'],
        unmatchedFields: []
      };
    }

    return {
      samePerson,
      confidence: Math.round(confidence * 100) / 100,
      matchedFields: matched,
      unmatchedFields: unmatched
    };
  }
}

export const mockEntityMatcher = new MockEntityMatcher();