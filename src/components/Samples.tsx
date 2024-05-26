import { worker } from './DataWorker';
import { Sample, sampleSize, UUIDed, Position } from './SamplesDef';

// max chunk size 4mb
const MAX_CHUNK_SIZE: number = 4 * 1024 * 1024;
const MAX_SAMPLES: number = Math.floor(MAX_CHUNK_SIZE / sampleSize());
let samples: Sample[] = [];

function sendSamples(
  { limit, clear=false, placeId, userId }: 
  { limit: number, clear?: boolean, placeId: string, userId: string }
) {
  let oldSamples = samples;
  // Async request
  const saveEndpoint = '/api/upload';
  if (clear) {
    samples = [];
  } else {
    samples = oldSamples.filter(sample => sample.time >= limit);
  }
  oldSamples = oldSamples.filter(sample => sample.time < limit);
  // sort by time
  oldSamples.sort((a, b) => a.time - b.time);
  
  if(0 < oldSamples.length) {
    if(MAX_SAMPLES < oldSamples.length) { // add to start of samples
      // Add elements to the start of samples
      samples = oldSamples.slice(MAX_SAMPLES).concat(samples);
      // Reduce oldSamples to the first MAX_SAMPLES elements
      oldSamples = oldSamples.slice(0, MAX_SAMPLES);
    }

    const count = oldSamples.length;
    if(count < 1) return;
    if(MAX_SAMPLES < count) {
      throw new Error('Too many samples to send: ' + count);
    }
    
    worker.postMessage({ 
      samples: oldSamples,
      endpoint: saveEndpoint,
      userId: userId ?? oldSamples[0].userId,
      placeId: placeId ?? oldSamples[0].placeId,
      count
    });
  }
}

function storeSample({
  sample, limit, placeId, userId
}: { sample: Sample, limit: number, placeId: string, userId: string }) {
  // goal should be within the range -2..2, just to be sure that its valid  
  const isValidGoal = (
    (-2 < sample.goal.x) && (sample.goal.x < 2) &&
    (-2 < sample.goal.y) && (sample.goal.y < 2)
  );
  if(!isValidGoal) {
    console.log('Invalid goal:', sample.goal);
    return;
  }
  samples.push(sample);
  if (samples.length >= 2 * MAX_SAMPLES) {
    sendSamples({ limit, clear: false, placeId, userId });
  }
}

export { storeSample, sendSamples };
export function validate(obj: UUIDed | null) {
  if (obj == null) return false;
  if (obj === undefined) return false;
  return obj.name.length > 0 && obj.uuid.length > 0;
}
export type { UUIDed, Position, Sample };