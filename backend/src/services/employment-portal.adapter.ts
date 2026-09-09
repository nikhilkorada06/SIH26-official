export type ExternalSubmissionStatus = 'NOT_CONFIGURED' | 'PENDING_EXTERNAL_SYNC' | 'EXTERNAL_SYNCED' | 'EXTERNAL_SYNC_FAILED';
export interface EmploymentPortalAdapter { submitApplication(applicationId: string): Promise<{ status: ExternalSubmissionStatus; externalApplicationId?: string }> }
class NotConfiguredEmploymentPortalAdapter implements EmploymentPortalAdapter {
  async submitApplication(_applicationId: string) { return { status: 'NOT_CONFIGURED' as const }; }
}
export const employmentPortalAdapter: EmploymentPortalAdapter = new NotConfiguredEmploymentPortalAdapter();
