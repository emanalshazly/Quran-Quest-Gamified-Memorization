import { createOutbox, isRetryableError, newOperationId } from './outbox';

/**
 * Offline-aware writes. Each action tries the server first; if it cannot be
 * reached the action is stored in the outbox and replayed when the
 * connection returns. Pure logic — the API client and storage are injected.
 */

const PASSING_SCORE = 70;

const isAlreadyMemorized = (error) =>
  error?.response?.status === 400 &&
  /already memorized/i.test(error.response?.data?.message || '');

export const createOfflineActions = ({ storage, memorizationAPI }) => {
  /**
   * record → analyze → memorize for one recitation.
   * NOTE: the score is still the placeholder computed on the device until
   * on-device AI scoring is integrated.
   */
  const sendTestResult = async (payload) => {
    const recordRes = await memorizationAPI.recordRecitation({
      kid_id: payload.kid_id,
      verse_id: payload.verse_id,
      audio_url: payload.audio_url,
      duration_seconds: payload.duration_seconds,
    });

    const analyzeRes = await memorizationAPI.analyzeRecording({
      recording_id: recordRes.recording.id,
      accuracy_score: payload.score,
      tajweed_score: payload.score,
      pronunciation_score: payload.score,
      errors_detected: null,
    });

    let memorizeRes = null;
    if (analyzeRes.isPassed && !payload.already_memorized) {
      try {
        memorizeRes = await memorizationAPI.markAsMemorized({
          kid_id: payload.kid_id,
          verse_id: payload.verse_id,
          recording_id: recordRes.recording.id,
          accuracy_score: payload.score,
        });
      } catch (error) {
        // Memorized by an earlier attempt whose response never arrived.
        if (!isAlreadyMemorized(error)) throw error;
      }
    }

    return { analyzeRes, memorizeRes };
  };

  const outbox = createOutbox({
    storage,
    handlers: {
      review: (payload) => memorizationAPI.submitReview(payload),
      test_result: (payload) => sendTestResult(payload),
    },
  });

  /** Submits a review, or queues it when the server cannot be reached. */
  const submitReview = async ({ kid_id, verse_id, accuracy_score }) => {
    const payload = {
      kid_id,
      verse_id,
      accuracy_score,
      // The same id is used for the live attempt and any later replay, so a
      // request that reached the server but lost its response is not applied twice.
      client_op_id: newOperationId(),
      reviewed_at: new Date().toISOString(),
    };

    try {
      const res = await memorizationAPI.submitReview(payload);
      return { ...res, queued: false };
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      await outbox.enqueue('review', payload);
      return { success: true, queued: true, pointsEarned: 0 };
    }
  };

  /** Submits a recitation test result, or queues it when offline. */
  const submitTestResult = async ({
    kid_id,
    verse_id,
    audio_url,
    duration_seconds,
    score,
    already_memorized,
  }) => {
    const payload = { kid_id, verse_id, audio_url, duration_seconds, score, already_memorized };

    try {
      const { analyzeRes, memorizeRes } = await sendTestResult(payload);
      return {
        queued: false,
        isPassed: analyzeRes.isPassed,
        feedback: analyzeRes.recording?.feedback_ar,
        pointsEarned: memorizeRes?.pointsEarned || 0,
        badges: memorizeRes?.badgesEarned || [],
        memorized: !!memorizeRes,
      };
    } catch (error) {
      if (!isRetryableError(error)) throw error;
      await outbox.enqueue('test_result', payload);
      return {
        queued: true,
        isPassed: score >= PASSING_SCORE,
        feedback: null,
        pointsEarned: 0,
        badges: [],
        memorized: false,
      };
    }
  };

  /** Verse ids with a queued action of the given type for a kid. */
  const pendingVerseIds = async (kidId, type) => {
    const operations = await outbox.pending();
    return operations
      .filter((op) => op.type === type && op.payload.kid_id === kidId)
      .filter((op) => type !== 'test_result' || op.payload.score >= PASSING_SCORE)
      .map((op) => op.payload.verse_id);
  };

  return { outbox, submitReview, submitTestResult, pendingVerseIds };
};
