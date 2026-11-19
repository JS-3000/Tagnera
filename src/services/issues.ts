// Fault reports ("Störung melden"). Goes through the data layer – with a server later,
// the same calls send the report to the backend (see services/outbox.ts).
import { data } from '../data';
import type { IssueReport, IssueStatus } from '../data/types';
import { nowIso, today, uuid } from '../lib/util';
import { addLogEntry, saveFile, savePhoto } from './tags';

export async function createIssue(input: {
  tagId: string;
  tagNumber: string;
  description: string;
  name: string;
  phone: string;
  photo: File | null;
}): Promise<IssueReport> {
  const file = input.photo ? await savePhoto(input.photo) : null;
  const now = nowIso();
  return data.issues.save({
    id: uuid(),
    tagId: input.tagId,
    tagNumber: input.tagNumber,
    description: input.description.trim(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    photoFileId: file?.id ?? null,
    status: 'new',
    logEntryId: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function setIssueStatus(issue: IssueReport, status: IssueStatus): Promise<void> {
  await data.issues.save({ ...issue, status, updatedAt: nowIso() });
}

/** "Als Tagebucheintrag übernehmen": diary entry at the component, then the report is closed. */
export async function takeOverIssue(issue: IssueReport, person: string): Promise<void> {
  const contact = [issue.name, issue.phone].filter(Boolean).join(', ');
  // own copy of the photo, so deleting the diary entry later does not remove the report photo
  const src = issue.photoFileId ? await data.files.get(issue.photoFileId) : undefined;
  const photo = src ? await saveFile(src.blob, src.name, src.mimeType) : null;
  const entry = await addLogEntry({
    tagId: issue.tagId,
    date: today(),
    person,
    kind: 'reparatur',
    description: `Störmeldung vom ${new Date(issue.createdAt).toLocaleDateString('de-DE')} (${contact}): ${issue.description}`,
    photoFileId: photo?.id ?? null,
    completedTaskIds: [],
    source: 'manual',
  });
  await data.issues.save({ ...issue, status: 'done', logEntryId: entry.id, updatedAt: nowIso() });
}

export async function openIssuesForTag(tagId: string): Promise<IssueReport[]> {
  return (await data.issues.findBy('tagId', tagId)).filter((i) => i.status !== 'done');
}

export async function countNewIssues(): Promise<number> {
  return (await data.issues.findBy('status', 'new')).length;
}
