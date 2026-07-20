// Minimal review hand-off UI. The host owns the actual workflow/data; this
// panel deliberately contains no auth, database, route, or profile logic.

import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels, StudioReviewRecord, StudioReviewService } from '../../react/types/public-api.js';

const STATUS: Record<StudioReviewRecord['status'], { label: string; color: string }> = {
  draft: { label: 'Not requested', color: '#6B6359' },
  requested: { label: 'Requested', color: '#9A5B00' },
  in_review: { label: 'In review', color: '#1257A0' },
  changes_requested: { label: 'Changes requested', color: '#B42318' },
  approved: { label: 'Approved', color: '#0B6E32' },
};

export function ReviewStatusPanel({ review, labels }: { review: StudioReviewService; labels?: StudioLabels }) {
  const { snapshot, store } = useEditorStore();
  const [record, setRecord] = useState<StudioReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void review.getCurrent(store.getDocument()).then((next) => {
      if (active) { setRecord(next); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // The host review record is keyed to the loaded document, not each edit.
    // It refreshes after request below; querying on every drawing stroke would
    // be both noisy and needlessly expensive.
  }, [review, store]);

  const request = async () => {
    if (requesting || record?.status === 'requested' || record?.status === 'in_review') return;
    setRequesting(true);
    try {
      const result = await review.request(store.getDocument());
      if (!result.ok || !result.review) throw new Error(result.error || 'Review request failed');
      setRecord(result.review);
      const message = (labels?.reviewRequested as string) || 'Review requested.';
      store.announce(message); store.toastMsg(message);
    } catch (error) {
      const message = (labels?.reviewRequestFailed as string) || 'Could not request review. Your work is still saved locally.';
      store.announce(message); store.toastMsg(message);
    } finally { setRequesting(false); }
  };

  const status = record ? STATUS[record.status] : STATUS.draft;
  const canRequest = !loading && record?.status !== 'requested' && record?.status !== 'in_review' && record?.status !== 'approved';
  const requestLabel = record?.status === 'changes_requested'
    ? ((labels?.requestReReview as string) || 'Request re-review')
    : ((labels?.requestReview as string) || 'Request review');

  return (
    <section role="region" aria-label={(labels?.reviewStatus as string) || 'Review status'} style={{ border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, padding: 10, minWidth: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{(labels?.reviewStatus as string) || 'Review status'}</strong>
        <span style={{ color: status.color, fontSize: 12, fontWeight: 750 }}>{loading ? 'Loading…' : status.label}</span>
      </div>
      {record?.feedback && <p style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.45, color: '#4C453E' }}>{record.feedback}</p>}
      {record?.updatedAt && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6B6359' }}>{new Date(record.updatedAt).toLocaleString()}</p>}
      {canRequest && <button type="button" disabled={requesting || snapshot.recoverOffer} onClick={request} style={{ marginTop: 9, minHeight: 32, border: 'none', borderRadius: 7, padding: '0 10px', background: 'var(--ts-primary, #C43D00)', color: '#fff', fontWeight: 750, fontSize: 12, cursor: requesting ? 'wait' : 'pointer' }}>{requesting ? ((labels?.reviewRequesting as string) || 'Requesting…') : requestLabel}</button>}
    </section>
  );
}
