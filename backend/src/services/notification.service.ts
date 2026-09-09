import Notification, { NotificationType } from '../models/Notification';

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  applicationId?: string;
}): Promise<void> {
  try {
    await Notification.create(input);
  } catch (error: unknown) {
    console.error(`Notification persistence failed: ${error instanceof Error ? error.name : 'UnknownError'}`);
  }
}
